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
- `POST /api/export`
- `POST /api/reconcile`
- `POST /api/backup`
- `POST /api/manual-snapshot`

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

## Absichtlich noch nicht automatisiert

comdirect-Depot und DKB-FinTS gehen in `WAITING_FOR_USER`, bis echte API- und
SCA-Verfahren in Stufe 0 geprüft wurden. Das verhindert, dass eine theoretische
Integration als funktionierend dargestellt wird. Enable Banking und Solana
werden nach Hinterlegung der jeweiligen Zustimmung beziehungsweise des
Helius-Schlüssels technisch abgerufen.
