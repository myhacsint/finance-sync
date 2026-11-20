"""Opt-in, secret-free FinTS dialog trace for diagnosing DKB continuation bugs.

Enabled only while the marker file ``$FINANCE_DATA_DIR/dkb-fints-trace.enable``
exists (no restart needed). Appends JSON lines to ``dkb-fints-trace.log`` in the
same directory. Only structural facts are recorded: dialog id, message numbers,
segment types, return codes/texts, masked system id. Segment contents, PIN,
TAN, user id, product id and account numbers are never read or written.
"""

from __future__ import annotations

import json
import os
import time
from typing import Any

_DIR = os.environ.get("FINANCE_DATA_DIR", "/app/data")
ENABLE_FILE = os.path.join(_DIR, "dkb-fints-trace.enable")
LOG_FILE = os.path.join(_DIR, "dkb-fints-trace.log")
_MAX_BYTES = 2_000_000


def enabled() -> bool:
    return os.path.exists(ENABLE_FILE)


def mask_id(value: Any) -> str:
    text = str(value or "")
    if len(text) <= 6:
        return f"<{len(text)} chars>"
    return f"{text[:3]}…{text[-3:]}({len(text)})"


def emit(event: str, **fields: Any) -> None:
    if not enabled():
        return
    try:
        if os.path.exists(LOG_FILE) and os.path.getsize(LOG_FILE) > _MAX_BYTES:
            return
        record = {"t": round(time.time(), 3), "pid": os.getpid(), "event": event}
        record.update(fields)
        with open(LOG_FILE, "a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False, default=str) + "\n")
    except Exception:
        pass


def dialog_state(dialog: Any) -> dict[str, Any]:
    try:
        numbers = {str(k.name): v for k, v in dialog.next_message_number.items()}
    except Exception:
        numbers = {}
    return {
        "dialogId": str(getattr(dialog, "dialog_id", "")),
        "next": numbers,
        "open": bool(getattr(dialog, "open", False)),
        "needInit": bool(getattr(dialog, "need_init", False)),
        "paused": bool(getattr(dialog, "paused", False)),
    }


def client_state(client: Any) -> dict[str, Any]:
    return {
        "systemId": mask_id(getattr(client, "system_id", "")),
        "secFn": str(getattr(client, "selected_security_function", "")),
        "bpdVersion": getattr(client, "bpd_version", None),
        "updVersion": getattr(client, "upd_version", None),
    }


def segment_types(message: Any) -> list[str]:
    out: list[str] = []
    try:
        for seg in message.segments:
            header = seg.header
            out.append(f"{header.type}v{header.version}")
    except Exception:
        pass
    return out


def install() -> None:
    """Wrap python-fints dialog/client calls with structural tracing."""
    if not enabled():
        return
    try:
        from fints.client import FinTS3PinTanClient
        from fints.dialog import FinTSDialog
    except Exception:
        return

    original_send = FinTSDialog.send
    original_init = FinTSDialog.init
    original_end = FinTSDialog.end
    original_pause = FinTSDialog.pause
    original_resume = FinTSDialog.create_resume.__func__  # type: ignore[attr-defined]
    original_process = FinTS3PinTanClient._process_response

    def send(self: Any, *segments: Any, **kwargs: Any) -> Any:
        started = time.time()
        before = dialog_state(self)
        kinds = [f"{s.header.type}v{s.header.version}" for s in segments if hasattr(s, "header")]
        try:
            response = original_send(self, *segments, **kwargs)
        except Exception as exc:
            emit("send-error", before=before, sent=kinds, error=type(exc).__name__,
                 detail=str(exc)[:200])
            raise
        emit("send", before=before, after=dialog_state(self), sent=kinds,
             internal=bool(kwargs.get("internal_send")),
             received=segment_types(response), ms=int((time.time() - started) * 1000))
        return response

    def init(self: Any, *extra: Any) -> Any:
        emit("dialog-init", state=dialog_state(self), **client_state(self.client))
        return original_init(self, *extra)

    def end(self: Any) -> Any:
        emit("dialog-end", state=dialog_state(self))
        return original_end(self)

    def pause(self: Any) -> Any:
        blob = original_pause(self)
        emit("dialog-pause", state=dialog_state(self), blobBytes=len(blob),
             **client_state(self.client))
        return blob

    def create_resume(cls: Any, client: Any, blob: bytes) -> Any:
        dialog = original_resume(cls, client, blob)
        emit("dialog-resume", state=dialog_state(dialog), blobBytes=len(blob),
             **client_state(client))
        return dialog

    def process(self: Any, dialog: Any, segment: Any, response: Any) -> Any:
        emit("response-code", code=str(getattr(response, "code", "")),
             text=str(getattr(response, "text", ""))[:160],
             ref=str(getattr(response, "reference_element", "") or "")[:20],
             state=dialog_state(dialog) if dialog is not None else None)
        return original_process(self, dialog, segment, response)

    FinTSDialog.send = send  # type: ignore[method-assign]
    FinTSDialog.init = init  # type: ignore[method-assign]
    FinTSDialog.end = end  # type: ignore[method-assign]
    FinTSDialog.pause = pause  # type: ignore[method-assign]
    FinTSDialog.create_resume = classmethod(create_resume)  # type: ignore[method-assign]
    FinTS3PinTanClient._process_response = process  # type: ignore[method-assign]
