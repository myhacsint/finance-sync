#!/usr/bin/env python3
"""Small JSON-over-stdin bridge between FinanceSync and PyFinTS.

Credentials are accepted only on stdin. They are never written to stdout, logs,
the continuation blob, or command-line arguments.
"""

from __future__ import annotations

import base64
import json
import logging
import re
import sys
from datetime import datetime, timezone
from typing import Any


def fail(message: str) -> None:
    print(json.dumps({"state": "ERROR", "message": message}, ensure_ascii=False))


def require_text(value: Any, label: str) -> str:
    text = str(value or "").strip()
    if not text:
        raise ValueError(f"{label} fehlt")
    return text


def validate(payload: dict[str, Any], network: bool) -> dict[str, Any]:
    product_id = require_text(payload.get("productId"), "FinTS Produkt-ID")
    if not re.fullmatch(r"[A-Za-z0-9]{25}", product_id):
        raise ValueError("FinTS Produkt-ID muss exakt 25 alphanumerische Zeichen enthalten")
    config = payload.get("config")
    if not isinstance(config, dict):
        raise ValueError("FinTS Konfiguration fehlt")
    if config.get("serverUrl") != "https://fints.dkb.de/fints":
        raise ValueError("Unerwarteter DKB-FinTS-Endpunkt")
    if not re.fullmatch(r"\d{8}", str(config.get("bankId") or "")):
        raise ValueError("Ungültige DKB Bankleitzahl")
    bic = str(config.get("bic") or "")
    if not re.fullmatch(r"[A-Z0-9]{8}(?:[A-Z0-9]{3})?", bic) or bic[4:6] != "DE":
        raise ValueError("Ungültige DKB BIC")
    accounts = config.get("accounts")
    if not isinstance(accounts, list) or not accounts:
        raise ValueError("Keine DKB-Depots konfiguriert")
    for account in accounts:
        if not isinstance(account, dict):
            raise ValueError("Ungültige DKB-Depotkonfiguration")
        if not re.fullmatch(r"[-a-zA-Z0-9_.]+", str(account.get("accountId") or "")):
            raise ValueError("Ungültige interne DKB-Depotkennung")
        if not re.fullmatch(r"\d{5,20}", str(account.get("accountNumber") or "")):
            raise ValueError("Ungültige DKB-Depotnummer")
    if network:
        require_text(payload.get("userId"), "DKB Anmeldename")
        require_text(payload.get("pin"), "DKB PIN")
    return config


def swift_decimal(value: str) -> str:
    value = value.strip()
    negative = value.startswith("N") or value.startswith("-")
    value = value[1:] if negative else value
    # SWIFT permits a decimal marker without fractional digits (for example
    # ``100,``). DKB uses this representation for whole-number quantities.
    if not re.fullmatch(r"\d+(?:,\d*)?", value):
        raise ValueError("Ungültige Dezimalzahl im DKB-Depotbestand")
    normalized = value.removesuffix(",").replace(",", ".")
    return f"-{normalized}" if negative else normalized


def collapse_mt535(raw: str) -> list[str]:
    clauses: list[str] = []
    current = ""
    for line in raw.splitlines():
        line = line.rstrip("\r")
        if line.startswith(":"):
            if current:
                clauses.append(current)
            current = line
        elif line.startswith("-"):
            if current:
                clauses.append(current)
                current = ""
            clauses.append(line)
        elif current:
            current += f"|{line}"
    if current:
        clauses.append(current)
    return clauses


def parse_mt535(raw: str) -> list[dict[str, str]]:
    positions: list[dict[str, str]] = []
    current: list[str] | None = None
    for clause in collapse_mt535(raw):
        if clause.startswith(":16R:FIN"):
            current = []
        elif clause.startswith(":16S:FIN"):
            if current is not None:
                positions.append(parse_instrument(current))
            current = None
        elif current is not None:
            current.append(clause)
    return positions


def parse_instrument(clauses: list[str]) -> dict[str, str]:
    position: dict[str, str] = {}
    for clause in clauses:
        identification = re.match(r"^:35B:ISIN\s+([A-Z]{2}[A-Z0-9]{9}\d)(?:\|[^|]*)?(?:\|(.*))?$", clause)
        if identification:
            position["isin"] = identification.group(1)
            if identification.group(2):
                position["name"] = " ".join(
                    identification.group(2).replace("|", " ").split()
                )
            continue
        quantity = re.match(r"^:93B::AGGR//(?:UNIT|FAMT)/(.+)$", clause)
        if quantity:
            position["quantity"] = swift_decimal(quantity.group(1))
            continue
        price = re.match(r"^:90[AB]::MRKT//(?:ACTU|PRCT)/([A-Z]{3})(.+)$", clause)
        if price:
            position["priceCurrency"] = price.group(1)
            position["price"] = swift_decimal(price.group(2))
            continue
        value = re.match(r"^:19A::HOLD//([A-Z]{3})(.+)$", clause)
        if value:
            position["marketValueCurrency"] = value.group(1)
            position["marketValue"] = swift_decimal(value.group(2))
            continue
        valuation = re.match(r"^:98A::PRIC//(\d{8})$", clause)
        if valuation:
            position["valuationDate"] = datetime.strptime(
                valuation.group(1), "%Y%m%d"
            ).date().isoformat()
    if not position.get("isin") or not position.get("quantity"):
        raise ValueError("Unvollständige Position im DKB-MT535-Depotbestand")
    return position


def b64(value: bytes) -> str:
    return base64.b64encode(value).decode("ascii")


def unb64(value: str) -> bytes:
    return base64.b64decode(value.encode("ascii"), validate=True)


def public_challenge(challenge: Any) -> dict[str, Any]:
    text = str(getattr(challenge, "challenge", "") or "Freigabe in der DKB-App erforderlich")
    return {
        "message": "DKB-Freigabe erforderlich",
        "challenge": text[:1000],
        "decoupled": bool(getattr(challenge, "decoupled", False)),
    }


def continuation(
    client: Any,
    challenge: Any,
    dialog_data: bytes,
    phase: str,
    account_index: int,
    completed: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        # PyFinTS only persists allowed_security_functions when private client
        # data is included. The blob never contains the PIN and is stored only
        # in the protected local FinanceSync database.
        "clientData": b64(client.deconstruct(including_private=True)),
        "dialogData": b64(dialog_data),
        "tanData": b64(challenge.get_data()),
        # PyFinTS 5.0.0 does not include this flag in NeedTANResponse.get_data().
        "decoupled": bool(getattr(challenge, "decoupled", False)),
        "phase": phase,
        "accountIndex": account_index,
        "completed": completed,
    }


def raw_payload(segment: Any) -> str:
    value = segment.holdings
    if isinstance(value, bytes):
        for encoding in ("utf-8", "iso-8859-1"):
            try:
                return value.decode(encoding)
            except UnicodeDecodeError:
                pass
        raise ValueError("DKB-MT535-Zeichensatz konnte nicht gelesen werden")
    return str(value)


def portfolio_from_segments(
    account: dict[str, Any], segments: list[Any], captured_at: str
) -> dict[str, Any]:
    raw_items = [raw_payload(segment) for segment in segments]
    positions: list[dict[str, str]] = []
    for raw in raw_items:
        positions.extend(parse_mt535(raw))
    if not positions:
        raise ValueError("DKB-FinTS lieferte für ein Depot keine erkennbaren Positionen")
    return {
        "accountId": account["accountId"],
        "capturedAt": captured_at,
        "rawMt535": raw_items,
        "positions": positions,
    }


def make_client(payload: dict[str, Any], client_data: str | None = None) -> Any:
    from fints.client import FinTS3PinTanClient

    config = payload["config"]
    return FinTS3PinTanClient(
        config["bankId"],
        payload["userId"],
        payload["pin"],
        config["serverUrl"],
        product_id=payload["productId"],
        product_version=config["productVersion"],
        from_data=unb64(client_data) if client_data else None,
    )


def select_tan(client: Any, config: dict[str, Any]) -> None:
    requested = str(config.get("tanMechanism") or "")
    if not client.get_current_tan_mechanism() or requested not in client.get_tan_mechanisms():
        client.fetch_tan_mechanisms()
    available = client.get_tan_mechanisms()
    if requested not in available:
        supported = ", ".join(sorted(available)) or "keines"
        raise ValueError(f"Konfiguriertes DKB-TAN-Verfahren ist nicht verfügbar; angeboten: {supported}")
    client.set_tan_mechanism(requested)
    tan_medium = str(config.get("tanMedium") or "").strip()
    if tan_medium:
        client.selected_tan_medium = tan_medium


def restore_tan_for_resume(client: Any, config: dict[str, Any]) -> None:
    """Restore the already negotiated TAN method without a new bank dialog.

    Older continuation blobs created by FinanceSync omitted PyFinTS'
    ``allowed_security_functions``. The BPD is still present, so restoring the
    configured method is sufficient and avoids starting another SCA request.
    """
    requested = str(config.get("tanMechanism") or "")
    if requested not in client.allowed_security_functions:
        client.allowed_security_functions.append(requested)
    client.set_tan_mechanism(requested)


def restore_challenge_for_resume(
    challenge: Any, state: dict[str, Any], config: dict[str, Any]
) -> Any:
    """Restore fields omitted by PyFinTS 5.0.0 challenge serialization."""
    challenge.decoupled = bool(
        state.get("decoupled", str(config.get("tanMechanism")) == "940")
    )
    return challenge


def account_model(config: dict[str, Any], account: dict[str, Any]) -> Any:
    from fints.models import SEPAAccount

    return SEPAAccount(
        "",
        config["bic"],
        account["accountNumber"],
        account.get("subaccount"),
        config["bankId"],
    )


def segment_factory(client: Any, config: dict[str, Any], account: dict[str, Any]):
    from fints.segments.depot import HKWPD5, HKWPD6

    hkwpd = client._find_highest_supported_command(HKWPD5, HKWPD6)
    model = account_model(config, account)

    def factory(touchdown: str | None):
        return hkwpd(
            account=hkwpd._fields["account"].type.from_sepa_account(model),
            touchdown_point=touchdown,
        )

    return factory


def request_holdings(client: Any, config: dict[str, Any], account: dict[str, Any]):
    factory = segment_factory(client, config, account)
    with client._get_dialog() as dialog:
        return client._fetch_with_touchdowns(
            dialog, factory, lambda responses: responses, "HIWPD"
        )


def prepare_touchdown_resume(client: Any, config: dict[str, Any], account: dict[str, Any]) -> None:
    factory = segment_factory(client, config, account)
    client._touchdown_responses = []
    client._touchdown_counter = 1
    client._touchdown = None
    client._touchdown_dialog = client._standing_dialog
    client._touchdown_segment_factory = factory
    client._touchdown_response_processor = lambda responses: responses
    client._touchdown_args = ("HIWPD",)
    client._touchdown_kwargs = {}


def fetch_remaining(
    client: Any,
    payload: dict[str, Any],
    start_index: int,
    completed: list[dict[str, Any]],
) -> dict[str, Any]:
    from fints.client import NeedTANResponse

    config = payload["config"]
    accounts = config["accounts"]
    captured_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    pending: tuple[Any, bytes, int] | None = None
    with client:
        if isinstance(client.init_tan_response, NeedTANResponse):
            dialog_data = client.pause_dialog()
            pending = (client.init_tan_response, dialog_data, start_index)
        else:
            for index in range(start_index, len(accounts)):
                result = request_holdings(client, config, accounts[index])
                if isinstance(result, NeedTANResponse):
                    dialog_data = client.pause_dialog()
                    pending = (result, dialog_data, index)
                    break
                completed.append(portfolio_from_segments(accounts[index], result, captured_at))
    if pending:
        challenge, dialog_data, index = pending
        response = public_challenge(challenge)
        response.update(
            state="WAITING_FOR_USER",
            continuation=continuation(
                client, challenge, dialog_data,
                "init" if challenge is client.init_tan_response else "holding",
                index, completed,
            ),
        )
        return response
    return {
        "state": "SUCCESS",
        "message": f"DKB-FinTS lieferte {sum(len(item['positions']) for item in completed)} Positionen",
        "portfolios": completed,
        "clientData": b64(client.deconstruct(including_private=True)),
    }


def fetch(payload: dict[str, Any]) -> dict[str, Any]:
    client = make_client(payload, payload.get("clientData"))
    select_tan(client, payload["config"])
    return fetch_remaining(client, payload, 0, [])


def continue_fetch(payload: dict[str, Any]) -> dict[str, Any]:
    from fints.client import NeedRetryResponse, NeedTANResponse

    state = payload.get("continuation")
    if not isinstance(state, dict):
        raise ValueError("DKB-FinTS Fortsetzungszustand fehlt")
    phase = str(state.get("phase") or "")
    if phase not in ("init", "holding"):
        raise ValueError("Ungültige DKB-FinTS Fortsetzungsphase")
    index = int(state.get("accountIndex", 0))
    completed = state.get("completed")
    if not isinstance(completed, list):
        raise ValueError("Ungültiger DKB-FinTS Zwischenstand")
    client = make_client(payload, require_text(state.get("clientData"), "FinTS Client-Zustand"))
    restore_tan_for_resume(client, payload["config"])
    challenge = restore_challenge_for_resume(
        NeedRetryResponse.from_data(
            unb64(require_text(state.get("tanData"), "FinTS TAN-Zustand"))
        ),
        state,
        payload["config"],
    )
    dialog_data = unb64(require_text(state.get("dialogData"), "FinTS Dialog-Zustand"))
    result: Any
    pending: tuple[Any, bytes] | None = None
    with client.resume_dialog(dialog_data):
        if phase == "holding":
            prepare_touchdown_resume(client, payload["config"], payload["config"]["accounts"][index])
        result = client.send_tan(challenge, str(payload.get("tan") or ""))
        if isinstance(result, NeedTANResponse):
            pending = (result, client.pause_dialog())
    if pending:
        next_challenge, next_dialog = pending
        response = public_challenge(next_challenge)
        response.update(
            state="WAITING_FOR_USER",
            continuation=continuation(
                client, next_challenge, next_dialog, phase, index, completed
            ),
        )
        return response
    if phase == "holding":
        captured_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        completed.append(
            portfolio_from_segments(payload["config"]["accounts"][index], result, captured_at)
        )
        index += 1
    return fetch_remaining(client, payload, index, completed)


def main() -> None:
    logging.disable(logging.CRITICAL)
    try:
        payload = json.load(sys.stdin)
        if not isinstance(payload, dict):
            raise ValueError("Ungültige FinanceSync-Eingabe")
        action = str(payload.get("action") or "")
        validate(payload, network=action in ("fetch", "continue"))
        import fints

        if action == "preflight":
            print(json.dumps({
                "state": "READY",
                "message": "PyFinTS ist installiert und die lokale Konfiguration ist gültig",
                "libraryVersion": getattr(fints, "__version__", "5.0.0"),
            }, ensure_ascii=False))
            return
        if action == "fetch":
            result = fetch(payload)
        elif action == "continue":
            result = continue_fetch(payload)
        else:
            raise ValueError("Unbekannte DKB-FinTS Aktion")
        print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    except Exception as exc:
        fail(f"{type(exc).__name__}: {exc}")


if __name__ == "__main__":
    main()
