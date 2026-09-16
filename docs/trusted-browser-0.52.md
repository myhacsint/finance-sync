# Browserzugang für eigene Geräte

Anmeldung: optional „Diesem Browser 90 Tage vertrauen“. Ohne Auswahl bleibt es bei
acht Stunden. Beide Sitzungsarten überstehen Dienstneustarts. Die Frist läuft ab
Anmeldung, nicht gleitend. Browserdaten löschen oder Privatmodus beenden kann eine
frühere Neuanmeldung erfordern. Nur über die private HTTPS-Adresse verwenden.

Unter Status → Browserzugänge lassen sich aktive Zugänge anhand Anmeldezeit,
Ablauf und Kennzeichnung des aktuellen Browsers einzeln widerrufen. Der Widerruf
des aktuellen Zugangs meldet sofort ab. Es gibt kein IP-basiertes Vertrauen und
kein Fingerprinting. Ein gestohlener Cookie bleibt bis Widerruf/Ablauf ein Risiko;
die Option daher nur auf eigenen, gesperrten Geräten wählen.

Implementierung: zufällige 256-Bit-Cookies, HttpOnly, SameSite Strict, Secure bei
HTTPS-Konfiguration. Nur SHA256-Nachweise in bestehender privater SQLite-Datenbank;
keine Klartext-Cookies/Verwaltungstokens. Tokenwechsel invalidiert alle Sitzungen.
Maximal 100 Sitzungen; Anmeldungen entfernen abgelaufene/alte Token-Nachweise.
API-Abfragen no-store, mutationsgeschützt gegen fremde Ursprünge.

Council-Leseendpunkte und Finanzberechnungen unverändert. Rückrollen auf ältere
Software beendet Sitzungen, verändert aber keine Finanzdaten. Ein Datenbankrestore
kann ältere Sitzungsnachweise wiederherstellen: anschließend Verwaltungstoken
rotieren oder Sitzungsnachweise gezielt widerrufen, keine Finanzdaten zurücksetzen.

Tests: Ablauf kurz/lang, Neustart mit wiederverwendetem Store, Widerruf, getrennte
Sitzungen, falscher Token, Klartextfreiheit, korrupter Store, Mengenlimit,
Desktop/375px-Anmeldung, Metadaten, CSRF, Abmelden.
