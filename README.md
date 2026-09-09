# 600.wtf · Die Gilde mit den Steinen

**Eine Nostr-Community. Eigenständige Napplets. Gemeinsame Projekte. Still not a cult.**

600.wtf entwickelt ein Gildensystem mit Mitgliederverzeichnis, lokalen Treffen,
privaten Gruppen und einer nachvollziehbaren Gemeinschaftskasse. Jede Funktion
wird ein eigenes **Napplet**: ein kleines Werkzeug, das einzeln funktioniert und
sich mit anderen kombinieren lässt. Der Nutzer stellt seine Oberfläche zusammen.

Heute gibt es eine bedienbare Community-Vorschau, einen separaten Elders-Desk und
zwei Raffle-Werkzeuge zum Planen und Erstellen von Vorschau-Losbögen. Die übrigen
Gildenfunktionen sind dokumentierte Entwürfe. Echte Auszahlungen sind geschlossen.

![Rock Garden: Nostr-Welcome und sichtbar geschlossener Faucet](docs/images/welcome-desktop.png)

[Funktionsstand](#was-heute-funktioniert) · [Raffle](#raffle-planen-und-lose-vorbereiten) ·
[Mitgliedschaft](#welcher-stein-bist-du) · [Technik](#technischer-teil) ·
[Lokal starten](#lokal-starten) · [Dokumentation](#dokumentation)

## Was heute funktioniert

| Bereich | Stand |
|---|---|
| Rock Garden | Responsive Welcome-Seite; NIP-07 liest einen öffentlichen Schlüssel für die lokale Anzeige |
| Elders-Desk | Eingefrorenes Verzeichnis der 30 Gründer; Schlüsselabgleich; Claims bleiben gesperrt |
| Raffle-Planer | Preisstufen, Presets, Ticketanzahl, Sats-Budget und Export eines Vorschau-Plans |
| Ticket-Printer | Eigenständiges Werkzeug; Plan importieren, Loslayout ansehen, Vorschau-PDF herunterladen |
| Supply-Modell | Reproduzierbare 21-Jahres-Rechnung mit ganzen atomaren Einheiten und Tests |
| Gilden-Komposition | 16 Werkzeuggrenzen, Archetypes, Intents und Berechtigungen dokumentiert; zwei Preview-Builds vorhanden |
| Marmot / FIPS / Liquid-Ausgabe | Architektur festgelegt; operative Dienste noch nicht angeschlossen |

Ein angezeigter Nostr-Schlüssel ist noch keine authentifizierte Mitgliedschaft.
Die aktuellen Seiten veröffentlichen keine Mitgliedschaft und zahlen keine Tokens aus.

## Raffle planen und Lose vorbereiten

Die Raffle nutzt die vorhandene Berechnungs- und PDF-Logik von
[dni / LNURLcash Raffle](https://github.com/lnurlcash/raffle). Der unveränderte
Quellstand ist mit Versionsnachweis und Tests im Repository enthalten.

1. **Planen:** Preset wählen, Preisstufen anpassen und das Sats-Budget prüfen.
2. **Übergeben:** Den eigenständigen Ticket-Printer öffnen. Im Host erfolgt das
   über einen Intent; die lokale Browser-Vorschau funktioniert auch ohne Host.
3. **Drucken:** Einen klar als Vorschau markierten PDF-Losbogen herunterladen.

![Raffle-Planer mit Preisstufen und Sats-Budget](docs/images/raffle-desktop.png)

![Separater Ticket-Printer mit nicht einlösbaren Vorschau-Losen](docs/images/ticket-printer.png)

Das Startbeispiel enthält **21 Lose**: eines mit 2.100 sat und zwanzig mit je
21 sat — zusammen **2.520 sat geplante Preise**. Es bewegt kein Geld. Alle
erzeugten PDFs enthalten ausschließlich Platzhalter. Echte LNURLcash-Ausgabe
benötigt den autorisierten Wallet-Dienst; PDF-Export im eingebetteten Host ist
bis zur Export-Anbindung deaktiviert. Ein Ticketpreis ist derzeit nur eine Rechnung.

## Welcher Stein bist du?

Das Ziel sind **600.000 verschiedene Mitglieder**. Es ist ein Ziel, keine
Behauptung über heutige Mitgliederzahlen.

| Ebene | Plätze | Bedeutung |
|---|---:|---|
| The Stoned / Elders | 600 | Persönlich getroffen und aufgenommen; 30 Gründungsplätze sind festgehalten |
| Rai Stones | 21.000 | Zweite Ebene der Community |
| Weitere Steine | 578.400 | Vorgeschlagene Kohorten: Obsidian, Basalt, Granite, Pumice und Pocket Pebbles |

**Elders sind IRL-only.** Ein bezahlter Titel macht niemanden zum Elder oder
Officer. Geplante Sammlerstücke und kosmetische Ränge kaufen weder Fortschritt
noch einen zweiten Welcome-Claim. Gruppenrechte werden separat geprüft.

![Elders-Desk mit Gründeranspruch und noch nicht geöffnetem Claim](docs/images/elders-desktop.png)

### Die Token-Zahlen richtig lesen

Das Liquid-Asset hat **600.000.000.000 atomare Einheiten bei acht Dezimalstellen**:
Das sind **6.000 ganze `600`-Tokens**. 21 ganze Tokens für jedes der 600.000
Mitglieder wären damit nicht finanzierbar.

Die bestätigte Elder-Zuteilung beträgt **1.827 ganze Tokens**:
30 × 21 für die Gründer und 570 × 2,1 für künftige Elders. Diese Planung ist noch
kein Nachweis einer finanzierten oder gesperrten Wallet. Online-Rewards, spätere
Verkäufe und Burns bleiben Vorschläge. Transfers verkleinern den Bestand der
Gildenkasse; nur tatsächliche Burns reduzieren die ausstehende Token-Menge.

[Rechnung, Annahmen und Quellen im 21-Jahres-Plan](docs/600-21-year-plan.md).
LNURLcash-Raffle-Sats und die Liquid-Reserve werden getrennt behandelt.

## Technischer Teil

### Architektur

![Geplante Architektur: einzelne Napplets, Intents, Host-Dienste und FIPS](docs/images/architecture.png)

[Eigenständige HTML-Grafik](docs/guild-architecture.html) ·
[Architekturentscheidung](docs/guild-system.md)

- **Napplets:** eine Funktion pro Bundle; voneinander unabhängig, ohne gemeinsamen
  DOM- oder Speicherzugriff. Raffle-Planer und Printer liegen als einzelne HTML-Builds vor.
- **Archetypes und NAP-INTENT:** der Aufrufer nennt Rolle und Vertrag. Der Host
  wählt den Handler; empfangene Daten werden validiert. Gildenspezifische Rollen
  sind Vorschläge und werden nicht als anerkannte Standards ausgegeben.
- **Nostr / NIP-07:** Identität und explizites Signieren im Host. Ein Sandbox-Napplet
  erhält keine privaten Schlüssel und keinen direkten Wallet-Zugriff.
- **Marmot:** ausgewähltes Protokoll für private Gruppen. Der Host verwaltet MLS-Zustand.
- **FIPS:** geplanter Mesh-Netzwerkweg; benötigt einen Node oder ein Gateway.
- **Ledger und Adapter:** geplantes SQLite-Audit für Mitgliedschaften, Claims und
  Recovery; Liquid und LNURLcash erhalten getrennte Abrechnungs- und Ausführungswege.

Die zwei Raffle-Napplets pinnen SDK **0.28.0**, core/nap **0.32.0** und Manifest-Plugin
**0.14.1**. Sie verwenden `convention/conventions`. Das ältere SDK im separaten
Palace-Projekt verwendet noch `protocol/protocols`; der Unterschied ist
[dokumentiert](docs/guild-intents.md). Browser-Tests verwenden Host-Domain-Fixtures,
keinen vollständigen installierten Produktions-Host.

### Lokale Einrichtung

Voraussetzungen: **Node.js 24**, npm, **Python 3.12+** und **uv**.
Aus dem Repository-Stamm:

```sh
npm ci
npm --prefix napplets ci --ignore-scripts
npm --prefix napplets run build
npx playwright install chromium
```

### Lokal starten

```sh
uv run --no-project python -m http.server 4173 --bind 127.0.0.1
```

| Werkzeug | Lokale Adresse |
|---|---|
| Rock Garden | <http://127.0.0.1:4173/pebbles.html> |
| Elders-Desk | <http://127.0.0.1:4173/elders.html> |
| Raffle-Planer | <http://127.0.0.1:4173/napplets/dist/raffle/index.html> |
| Ticket-Printer | <http://127.0.0.1:4173/napplets/dist/ticket-printer/index.html> |

Die gebauten Raffle-HTMLs und Manifest-Metadaten sind eingecheckt, damit die
bestehende statische Website sie direkt ausliefern kann. Nach Quelländerungen
beide Builds erneuern. Die lokalen Manifest-Dateien sind keine veröffentlichte,
signierte Installation. Dieser PR richtet keinen Produktionsdienst ein.

### Prüfen und reproduzieren

```sh
npm run test:unit
npm --prefix napplets test
npm --prefix napplets run typecheck
npx playwright test tests/pebbles.spec.ts tests/elders.spec.ts tests/raffle.spec.ts
node scripts/supply-plan.mjs
node scripts/capture-readme.mjs
```

Der lokale Server muss für Browser-Tests und Screenshots laufen. Die Raffle-Suite
umfasst 39 Tests einschließlich der übernommenen Upstream-Tests. Browser-Checks
prüfen Formularvalidierung, mobile Darstellung, PDF-Download, Intent-Übergabe und
geschlossene Auszahlungen. Tests decken keine echte Mint-Ausgabe, Wallet-Custody
oder Produktions-Host-Kompatibilität ab.

Der vollständige Testlauf umfasst außerdem ältere Seiten. Ergebnisse und etwaige
vorhandene Fehler werden im PR getrennt von der Feature-Prüfung ausgewiesen.

### Repository-Struktur

```text
pebbles.* / elders.*     Community-Vorschau und Gründer-Desk
data/                   Roster-Snapshot, Charta und Napplet-Katalog
napplets/src/           Raffle- und Printer-Implementierung, Boundary-Validierung
napplets/vendor/        Unveränderter, gepinnter Upstream-Quellstand
napplets/dist/          Zwei gebaute HTML-Napplets mit Manifest-Metadaten
scripts/                Supply-Rechnung und reproduzierbare Screenshots
tests/                  Browser-, Katalog- und Modelltests
docs/                   Entscheidungen, Verträge, Quellen und Abbildungen
```

## Dokumentation

| Dokument | Inhalt |
|---|---|
| [Gildensystem](docs/guild-system.md) | Aufnahme, Rollen, Marmot und FIPS |
| [Composable Napplets](docs/guild-napplets.md) | Die 16 eigenständigen Funktionen |
| [Intents und Archetypes](docs/guild-intents.md) | Payloads, Handlersuche, Fehlerfälle und SDK-Abgleich |
| [Raffle-Integration](docs/raffle-integration.md) | Upstream-Herkunft, Implementierung und verbleibende Anbindungen |
| [21-Jahres-Plan](docs/600-21-year-plan.md) | Token-Einheiten, Reserven, Szenarien und Jahresrechnung |
| [Identität und Recovery](docs/elder-identity-napplet.md) | Schlüsselprüfung und vorgeschlagene Elder-Freigaben |

## Mitwirken und Herkunft

Änderungen bleiben klein und überprüfbar. Funktion, Vertrag und Tests werden
gemeinsam geändert; Originaldaten und vendorte Quellen bleiben unverändert.
Commits folgen Conventional Commits. Vor einer Veröffentlichung sind Review
und die jeweiligen Integrationsprüfungen erforderlich.

Neue Napplet-Quellen tragen MIT-Lizenzhinweise. Die wiederverwendete Raffle-Logik
stammt von **dni / lnurlcash**; Herkunft und Lizenzmetadaten stehen in
[napplets/vendor/README.md](napplets/vendor/README.md); Lizenztexte der Runtime-
Abhängigkeiten in [THIRD_PARTY_NOTICES.md](napplets/THIRD_PARTY_NOTICES.md). Vorhandene Marken- und
Charakterbilder werden durch diese Code-Lizenz nicht pauschal neu lizenziert.

*wir foan a aundas program.*
