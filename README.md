# FinanceSync

FinanceSync ist der integrations- und archivorientierte Teil des Finanz-Hubs. Der
Dienst speichert Rohdaten unverändert, normalisiert sie in SQLite und erzeugt
atomare CSV-Exporte. Actual und Ghostfolio sind nachgelagerte Ansichten, nicht
das Langzeitarchiv.

## Sicherheitsmodell

- Das Image enthält keine persönlichen Daten oder Zugangsdaten.
- Geheimnisse werden als einzelne Dateien unter `/run/secrets` eingehängt.
- `/health` ist ohne Anmeldung abrufbar; alle Verwaltungs-APIs benötigen das
  Bearer-Token aus `/run/secrets/admin-token`.
- Solana benötigt nur öffentliche Wallet-Adressen und einen Helius-API-Key,
  niemals Seed Phrase oder Private Key.
- Enable Banking signiert kurzlebige API-JWTs lokal mit
  `/run/secrets/enable-banking-private-key.pem`; der private Schlüssel verlässt
  den Server nicht.
- DKB-FinTS liest Produkt-ID, Anmeldename und PIN ausschließlich aus den Dateien
  `dkb-fints-product-id`, `dkb-fints-user-id` und `dkb-fints-pin`. Die Werte
  werden per Standardeingabe an den lokal im Container laufenden PyFinTS-Kernel
  übergeben und weder in Argumenten noch in den Roharchiven gespeichert.

## Lokaler Test

```sh
npm ci
npm test
docker build -t finance-sync:dev .
```

## Verzeichnisse

| Containerpfad | Zweck |
|---|---|
| `/app/data` | Konfiguration und SQLite |
| `/archive` | `raw`, `normalized` und `exports` |
| `/inbox` | Dokumentablage |
| `/run/secrets` | nur lesbare Secret-Dateien |

Die Beispielkonfiguration liegt in `config.example.json`. Alle externen Quellen
sind darin zunächst deaktiviert. Die beiden manuellen Vorsorgequellen sind
bereits angelegt.

## Verwaltungs-API

- `GET /health`
- `GET /api/status`
- `POST /api/sync/:source`
- `POST /api/enable-banking/start/:source`
- `POST /api/dkb-fints/preflight/:source` (rein lokale Prüfung, kein Bankkontakt)
- `POST /api/dkb-fints/continue/:source` (App-Freigabe erneut prüfen)
- `POST /api/export`
- `POST /api/reconcile`
- `POST /api/backup`
- `POST /api/manual-snapshot`
- `GET /api/dashboard/analyses/recurring-expenses`
- `GET /api/dashboard/analyses/recurring-expenses/:candidate`
- `PUT /api/decisions/recurring-expenses/:candidate`
- `GET /api/dashboard/review` (`?months=3|6|12`, default 6)
- `PUT /api/dashboard/review/transaction`
- `PUT /api/dashboard/review/merchant-alias`

Die API für regelmäßige Ausgaben wertet ausschließlich bereinigte
Actual-Einzelbuchungen aus. Kandidaten und Buchungsschlüssel sind
pseudonymisiert. Nutzerentscheidungen werden mit dem aktuellen
Beleg-Fingerprint in der FinanceSync-Datenbank gespeichert; sie schreiben
weder nach Actual zurück noch verändern sie die bestehende
Ausgabenklassifikation.

In der Verwaltungsoberfläche gibt es zusätzlich den bestätigungspflichtigen
Bereich **Vorsorge aktualisieren**. Er unterstützt kopierten Text aus dem
Sutor-Depotbestand und der Alte-Leipziger-Vertragsansicht:

1. Quelle auswählen und den vollständigen Text einfügen.
2. Stichtag, Gesamtwert, Positionen und Ghostfolio-Zuordnungen in der Vorschau
   prüfen. Dabei werden noch keine Daten verändert.
3. Die Prüfung bestätigen und den Stand übernehmen.

Vor der Übernahme wird ein konsistenter SQLite-Snapshot unter
`normalized/snapshots/` angelegt. Danach werden Roharchiv, normalisierte
Datenbank, CSV-Exporte und die rekonstruierte Ghostfolio-Position aktualisiert.
Ein identischer Stichtag erzeugt keine Dubletten. Ein bereits vorhandener,
abweichender Stand desselben Datums wird blockiert.

Die Quelle benötigt dafür eine `settings.manualWorkflow`-Konfiguration mit
`provider`, `accountId`, `owner` und einer frei wählbaren `label`. Die
Ghostfolio-Ziele bleiben ausschließlich in der privaten `config.json`:

```json
{
  "settings": {
    "manualWorkflow": {
      "provider": "sutor",
      "accountId": "sutor-riester-person-a",
      "owner": "Person A",
      "label": "Sutor Riester"
    }
  }
}
```

Beispiel für einen bestätigten Vertragswert:

```json
{
  "sourceId": "sutor-riester",
  "accountId": "riester-1",
  "amount": "12345.67",
  "currency": "EUR",
  "capturedAt": "2026-07-26T12:00:00Z",
  "owner": "Person A"
}
```

Bei manuellen Depotständen können Positionen zusätzlich mit verlustfreiem
Quellkurs und dem im Dokument ausgewiesenen Kurswert übergeben werden:

```json
{
  "sourceId": "sutor-riester",
  "accountId": "riester-1",
  "amount": "18526.30",
  "currency": "EUR",
  "capturedAt": "2026-03-31",
  "owner": "Person A",
  "holdings": [{
    "symbol": "IE00BL25JN58",
    "name": "Xtrackers MSCI World Min Vol ETF",
    "quantityAtomic": "4336642",
    "atomicDecimals": 4,
    "priceAtomic": "491199",
    "priceDecimals": 4,
    "priceCurrency": "USD",
    "marketValueMinor": "1852630",
    "marketValueCurrency": "EUR"
  }]
}
```

## DKB-Depot über FinTS

Der DKB-Connector verwendet den nur lesenden Geschäftsvorfall HKWPD 5/6. Die
registrierte 25-stellige Produkt-ID wird von PyFinTS als Produktbezeichnung in
HKVVB gesetzt. Depotnummern und Eigentümer stehen nur in der privaten
`config.json`; die Beispielkonfiguration enthält ausschließlich Platzhalter.

Der erste Abruf wird bewusst in zwei Schritten durchgeführt: `sync` startet den
Abruf und liefert bei notwendiger DKB-App-Freigabe `WAITING_FOR_USER`. Nach der
Bestätigung in der App setzt `continue` denselben FinTS-Dialog fort. Der dafür
benötigte opake Zustand liegt in der lokalen FinanceSync-Datenbank und enthält
keine PIN.

`publishToGhostfolio` bleibt für den ersten realen Abruf `false`. Damit werden
Rohdaten, Positionen und Depotwerte zunächst nur im FinanceSync-Archiv erfasst
und mit dem bestehenden Dokumentbestand verglichen. Erst nach erfolgreicher
Abstimmung wird die Weitergabe an Ghostfolio separat freigeschaltet.

Das comdirect-Depot bleibt bis zur Prüfung einer echten API- und
PushTAN-Sitzung in `WAITING_FOR_USER`.
