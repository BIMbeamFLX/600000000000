# Übergabe an Grok: Marmot-Gruppe und Chat

Stand: 10. September 2026. Auftrag: unabhängiger Architektur-, Code- und
Sicherheits-Audit vor der Anbindung echter Mitglieder. Dies ist die Übergabe,
kein abgeschlossener Audit und keine Produktionsfreigabe.

## Auftrag zum direkten Übernehmen

Prüfe das öffentliche Repository
[BIMbeamFLX/600000000000](https://github.com/BIMbeamFLX/600000000000).
Die feste Code-Basis dieses Auftrags ist
[`7143a4f4f7372f33b3d38703f737626a3c508fd7`](https://github.com/BIMbeamFLX/600000000000/tree/7143a4f4f7372f33b3d38703f737626a3c508fd7),
Branch `codex/guild-workspace`, [PR #12](https://github.com/BIMbeamFLX/600000000000/pull/12).
Prüfe den gesamten relevanten Code dieses Commits, nicht nur den PR-Diff: #12
baut auf [#11](https://github.com/BIMbeamFLX/600000000000/pull/11) und
[#10](https://github.com/BIMbeamFLX/600000000000/pull/10) auf. Dokumentationsnachträge
ändern die hier festgehaltene Code-Basis nicht.

Das unmittelbare Produktziel ist **eine echte private Marmot-Gruppe mit Chat**.
Jede Funktion bleibt ein eigenes, unabhängig ladbares Napplet. Einladen,
Beitreten, Entfernen und Gruppenrollen bleiben getrennt; Lesen/Senden einer
Unterhaltung gehört zum eigenen Chat-Napplet. Die Shell komponiert die Werkzeuge.
Meetups, Kalender, Aufgaben, Ortsgruppen, Kasse und Kosmetik sind spätere Ausbaustufen.

Unterscheide belegte Fehler, fehlende Implementierung und offene Designentscheidungen.
Liefere reproduzierbare Befunde und den kleinsten notwendigen Weg zum ersten
sicheren Gruppenbetrieb. Keine weiteren Gildenfeatures bauen. Keine echten
Mitglieder kontaktieren, Gruppen verändern, Nachrichten exportieren oder Secrets
anfordern. Reproduktion nur mit isolierten Daten und eigens erzeugten Testidentitäten.
Keine Änderungen an Originalquellen und kein Merge/Deployment im Rahmen des Audits.

## Was tatsächlich existiert

| Bestandteil | Belegbarer Stand |
|---|---|
| Vier Gruppen-Napplets | UI für invite/join/remove/role; kein eigener Marmot-Client |
| Host-Berechtigungen | `guildCapability` begrenzt Aktionen pro Tool; Identitätsversion und aktuelle Rechte werden geprüft |
| Externe Aufträge | `ExternalJournal` persistiert Request-ID, Zustand und Receipt; unsichere Ergebnisse werden abgefragt |
| Gruppendienst | Vertrag `protocol`, `authorize`, `execute`, `status`; kein produktiver Adapter angeschlossen |
| Chat | `guild-chat` steht im Katalog als Entwurf; kein gebautes Chat-Napplet und keine Nachrichtenpipeline |
| Demo auf Port 4175 | Fest eingestellter fiktiver Officer, Identitätsversion 1, lokale SQLite-Daten; kein produktives Login |
| Recovery | Signaturprüfung, Quorum, Wartefrist, Identitätswechsel und Folgeaufträge vorhanden; reale Guardians/Dienste nicht konfiguriert |
| Produktivnachweis | Kein nachgewiesener Austausch echter Marmot-Nachrichten zwischen zwei Clients |

Die bisher gemeldeten **74 bestandenen Tests** umfassen 16 Host-, 42 Vitest-,
8 Katalog/Supply- und 8 Browser-Tests. Das ist der Nachweis des vorherigen
Implementierungslaufs, kein neu durchgeführter unabhängiger Audit. Marmot-Receipts
in diesen Tests sind Fixtures. Testzahlen, Screenshots und der String
`protocol: 'marmot'` belegen weder MLS-Konformität noch Produktionsbereitschaft.

## Zuerst lesen

Die Pfade beziehen sich auf den oben verlinkten Commit:

| Datei | Audit-Schwerpunkt |
|---|---|
| `napplets/host/guild-capability.mjs` | Begrenzung pro Tool, aktuelle Identität, Berechtigungen vor/nach asynchronen Aufrufen |
| `napplets/host/external-journal.mjs` | Zustandsautomat, Request-Fingerprint, Wiederaufnahme und konkurrierende Worker |
| `napplets/host/guild-store.mjs` | Vertrauenswürdiger Actor, Rollen, SQLite-Transaktionen und Audit-Protokoll |
| `napplets/src/group-tool.ts` | Unbekannte Ergebnisse, gesperrte Formulare, Wiederherstellung offener Requests |
| `napplets/src/workspace-ui.ts` | Sandbox, Host-Erweiterung, Navigation und Wiederholungen |
| `scripts/guild-workspace.mjs` | Grenze zwischen lokaler Demo und echtem Host; keine Produktionsauthentifizierung |
| `napplets/host/recovery.mjs` | Guardians, Signaturen, Rotation, `sessionVersion`, `confirmFollowup` |
| `napplets/host/recovery-capability.mjs` | Signer-Bindung und Zugriff auf Recovery-Fälle |
| `napplets/host/recovery-followups.mjs` | Widerruf vor Veröffentlichung; Adapter-Bestätigungen und veraltete Recovery |
| `napplets/host/guild.test.mjs`, `napplets/host/recovery.test.mjs` | Was getestet ist und welche Annahmen die Fixtures machen |
| `tests/guild-workspace.browser.ts` | UI-Nachweise; insbesondere Fixture-Grenzen |
| `data/guild-napplets.json`, `docs/guild-intents.md` | Archetypes, Payloads, Entwürfe versus gebaute Verträge |
| `docs/guild-workspace.md` | Adapter-Verträge und ausdrücklich fehlende Produktionsverbindungen |

Separat wurde lokal `G:/Github/nappelin.com/apps/hangar/src/host.ts` geprüft:
Dieser Host verwendet aktuell ein flüchtiges Speicher-Relay. Die Datei ist nicht
Teil dieses öffentlichen Repositorys. Diese Beobachtung ist kein auditierbarer
Release-Pin des Hosts. Für den Integrationsaudit den tatsächlich gewählten Host
mit zugänglichem Repository, Commit und Konfiguration separat festhalten.

Die [aktuelle Marmot-Spezifikation](https://github.com/marmot-protocol/marmot)
trennt Foundation, Protocol Core, Transports, App Components und Features;
die README bezeichnet MIP-era-Dokumente als veraltet. Vor Implementierung
Spezifikation **und** konkrete Client-Bibliothek auf kompatible Revisionen pinnen.
Ein älterer Client unterstützt nicht automatisch die heutige Spezifikation.
Lizenz und transitive Abhängigkeiten prüfen; eigene Module bleiben MIT.

## Produktionsblocker für den ersten Gruppenbetrieb

1. **Echter Host und verifizierte Identität.** NIP-07 im vertrauenswürdigen Host,
   ausdrückliche Signierzustimmung und überprüfter Besitz des angemeldeten Schlüssels.
   Eine öffentliche Schlüsselausgabe allein ist kein Login. Anmeldung muss an Domain,
   Sitzung und einen frischen, einmal verwendbaren Nachweis gebunden sein. Wechsel
   des Signers und Logout schließen alte Zugriffe und löschen private UI-Caches.
2. **Marmot-Client mit dauerhaftem MLS-Zustand.** Bibliothek/Client auswählen,
   Version pinnen, sicher hostseitig betreiben. Gruppen müssen tatsächlich erstellt
   oder autorisiert übernommen werden können. Vorhandene Client-Instanz und
   Gruppen-Referenzen sind bislang nicht bereitgestellt. Keine Eigenbau-Kryptografie.
3. **Mitgliedschaft bis zum tatsächlichen Client-Commit.** KeyPackages und Welcome
   prüfen, Einladung, Beitritt, Entfernung und administrative Berechtigungen an
   den realen Client anbinden. Gruppen-ID-Eingabe und `member/moderator`-Strings
   erzeugen keine Autorität. Eine Mindestliste überprüfter Mitglieder/Admins reicht
   für einen begrenzten Start; automatische Admission ist dafür nicht erforderlich.
4. **Eigenes Chat-Napplet.** Berechtigte Gruppen auswählen, Nachrichten senden und
   empfangen, begrenzte Historie laden, Nachrichten deduplizieren, Zustellzustände
   ehrlich anzeigen und nach Offline-Zeit wieder synchronisieren. MLS-Geheimnisse
   bleiben im Host. Nur berechtigter Nachrichteninhalt darf an das Chat-Napplet;
   kein privater Chat über öffentliche Fallback-Events oder den Spiel-Presence-Kanal.
5. **Betrieb und Ausfälle.** Tatsächliche Relay-/Transportkonfiguration, geschützte
   Speicherung und getesteter Neustart/Restore. Ein Endpoint-Ausfall darf keine
   stillen Verluste oder einen Sicherheits-Downgrade verursachen. Mehrere
   Übertragungswege gemäß der gewählten Marmot-Version testen. Logs dürfen keine
   Chattexte, Keys oder Welcome-Geheimnisse veröffentlichen. Ressourcenbegrenzungen
   und Wiederanlauf müssen am echten Dienst nachgewiesen werden.
6. **Integration mit unabhängigen Identitäten.** Die nachfolgenden Szenarien müssen
   mit echten Client-Zuständen bestehen; ein Mock-Receipt genügt nicht.

Ein FIPS-Status-Napplet ist keine Voraussetzung für den Chat. Falls der tatsächliche
Transport FIPS verwendet, gehört dessen Verbindung zum Integrationstest. Ein
Status-Label ersetzt weder verschlüsselte Nachrichtenübertragung noch deren Nachweis.

## Audit-Hypothesen zum gezielten Reproduzieren

Diese Punkte sind Prüfansätze, keine bereits unabhängig bestätigten Schwachstellen:

- Der Journal-Fingerprint nutzt `JSON.stringify(request)`. Ändert eine andere
  Property-Reihenfolge trotz semantisch identischem Request das Wiederaufnahmeverhalten,
  besonders nach `pending()` und erneutem Submit?
- Zwei verschiedene Request-IDs können dieselbe fachliche Gruppenänderung meinen.
  Was verhindert konkurrierende MLS-Commits pro Gruppe? Gleiches gilt für mehrere
  Browser-Tabs und Worker. Request-Deduplizierung allein ist kein Exactly-once-Beweis.
- Welche Zustände bleiben nach einem Absturz zwischen `prepared`, `dispatched`,
  externer Wirkung und gespeicherter Bestätigung dauerhaft blockiert? Wer darf
  sie auflösen? Kann nach tatsächlich erfolgtem Rechteentzug noch sicher reconciled
  werden, ohne dem alten Actor wieder Berechtigungen zu geben?
- Host-Prüfungen vor/nach `await` verhindern nicht automatisch einen inzwischen
  veralteten externen Commit. Prüfe, ob der echte Adapter Identitätsversion und
  Gruppenberechtigungen am Zeitpunkt der Wirkung durchsetzt.
- Beim UI-Fehler nach Submit bleiben Felder möglicherweise gesperrt. Unterscheide
  endgültige Ablehnung ohne Wirkung von verloren gegangener Antwort. Prüfe außerdem,
  ob die Anzeige mehrerer offener Requests versehentlich den falschen als erledigt zeigt.
- Wer kann ein `receiptId` behaupten? Prüfe die Authentizität und konkrete Bindung
  an Gruppe, Aktion, Zielmitglied und MLS-Zustand im Adapter. Ein frei erfundenes
  `confirmed: true` ist kein sicherer Adapter.
- Welche privaten Daten bleiben nach Gruppenentfernung, Logout oder Key-Wechsel
  in Frames, Browser-Speichern, Host-Caches, Subscriptions und Backup-Dateien?

## Minimale Abnahme mit Testidentitäten A, B und C

A ist verifizierter Gruppen-Admin, B ein eingeladenes Mitglied, C ein nicht
berechtigter Außenstehender. Verwende getrennte Clients und getrennten Speicher.

1. A erstellt/übernimmt eine echte private Gruppe und lädt B ein. B prüft und
   akzeptiert die Einladung. Replay oder eine Einladung für eine andere Gruppe
   darf keinen Beitritt erzeugen.
2. A und B tauschen Nachrichten aus. Ein echter, separat gepinnter kompatibler
   Client bestätigt die Interoperabilität. C kann weder Verlauf lesen noch senden,
   beitreten oder sich administrative Rechte geben.
3. B geht offline; A sendet weiter. B verbindet sich erneut und erhält die
   berechtigten Nachrichten ohne Duplikate. Server-/Client-Neustart und Ausfall
   eines Transportwegs werden getestet.
4. A entfernt B. Neue Nachrichten nach dem Removal-Commit sind für B nicht
   entschlüsselbar; Senden und Wiederbeitritt ohne neue Einladung werden abgewiesen.
   B kann bereits erhaltene Klartexte behalten: rückwirkendes Löschen wird nicht versprochen.
5. Simuliere eine verlorene Antwort nach erfolgreichem Commit sowie zwei
   gleichzeitige Mitgliedschaftsänderungen. Keine doppelte Wirkung, keine dauerhaft
   auseinanderlaufenden Gruppen, nachvollziehbare Zustände nach Neustart.
6. Prüfe Signer-Wechsel, fremde Gruppenreferenzen, manipulierte Nachrichten,
   unerwartete/alte Epochen und Payload-Replay. Eine manipulierte Napplet-Frame darf
   weder Schlüssel lesen noch sich Host-Rechte beschaffen.

## Recovery und spätere Funktionen

**Empfehlung für den ersten begrenzten Chat-Start:** automatische Avatar-Recovery
deaktiviert lassen und als nicht verfügbar anzeigen, bis Guardians, Signer,
Session-Widerruf, Marmot-Rotation und Identitätsveröffentlichung vollständig
integriert und separat auditiert sind. Keine Anleitung behauptet dann, die Gilde
könne verlorene Schlüssel bereits ersetzen. Grundlegender Entzug von Gruppenzugriff
und sichere aktuelle Identitäten bleiben trotzdem Pflicht.

Wenn Recovery zum Start angeboten wird, ist sie ein zusätzlicher Release-Blocker:
85%-Quorum der festgelegten Guardians, Wartefrist, erneute Autorisierung, Ausschluss
veralteter Schlüssel, vollständige Widerrufe und Veröffentlichung müssen am
tatsächlichen Gesamtsystem nachgewiesen werden. Wallet-Recovery bleibt unabhängig.
WoT, Chat-Aktivität und bezahlte Ränge bestimmen keine Recovery-Autorität.

Meetups, Kalender, Aufgaben, Ortsgruppen, Kasse, kosmetische Käufe, Faucet und Raffle
gehören nicht auf den kritischen Pfad dieses Chat-Releases. Vorhandene Demos dürfen
bleiben, dürfen aber nicht mit einem produktiven Dienst verwechselt werden.

## Reproduktion und erwartetes Ergebnis

In einem isolierten Checkout der festgelegten Revision, mit Node.js 24:

```sh
npm ci
npm --prefix napplets ci
npx playwright install chromium
npm --prefix napplets run typecheck
npm --prefix napplets run test:host
npm --prefix napplets test
npm run test:unit
npm run test:e2e:guild
```

Die Gilden-Browser-Suite startet normalerweise ihren eigenen lokalen Demo-Host.
Bei einem bereits laufenden Host kann `GUILD_EXTERNAL_HOST=1` gesetzt werden;
dieser Host enthält nur Testdaten. Der alte Entwicklungscheckout enthält separate,
nicht zum Audit gehörende Bildänderungen. Keine Originaldateien dafür reparieren.

Erwartete Audit-Lieferung:

- P0/P1/P2-Befunde mit Datei und Zeile der geprüften Revision, Trigger, erwartetem
  versus tatsächlichem Verhalten, Auswirkung und minimaler Korrektur.
- Gesonderte Liste fehlender Implementierungen und nicht überprüfbarer Aussagen.
- Tatsächlich ausgeführte Tests samt Ergebnis; vorgeschlagene Tests separat.
- Konkrete Host-/Client-/Spezifikations-Pins und begründete Integrationsentscheidung,
  soweit überprüfbar. Unbekannte Endpunkte oder Rechte nicht erfinden.
- Freigabeurteil getrennt für lokale Demo, begrenzten Chat-Pilot und öffentlichen
  Betrieb. Bis ein realer Gruppen-/Nachrichtenpfad nachgewiesen ist: **keine
  Produktionsfreigabe für Marmot-Chat**.

Der Architektur-Audit kann jetzt beginnen. Nach Implementierung des echten Clients
und Chat-Napplets ist ein zweiter Integrations-/Sicherheits-Audit erforderlich.
