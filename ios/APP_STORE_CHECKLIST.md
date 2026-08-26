# App Store Checkliste - Ping Pong Counter

## Technische App-Daten

- App-Name: Ping Pong Counter
- Entwickler/Brand: AppReich
- Bundle-ID: `io.github.schmidi321.pingpongcounter` (Vorschlag, siehe README.md) - vor erstem Upload
  in App Store Connect reservieren, danach nicht mehr aenderbar
- App-Typ: WKWebView-Wrapper (PWABuilder/Capacitor) fuer die bestehende PWA
- Live-Domain: https://schmidi321.github.io/pingpong-tracker/ (bereits live, HTTPS, Service Worker aktiv)
- Zielgruppe: Tischtennis-Spieler, Trainer, Vereine, Hobbygruppen
- Kategorie: Sport (primaer), Dienstprogramme (sekundaer)
- Apple Developer Program: noch nicht angelegt (99 $/Jahr)

## Aktueller Funktionsumfang

Identisch zur Android-Version, siehe `android/PLAY_STORE_CHECKLIST.md` Abschnitt "Aktueller
Funktionsumfang" - beide Plattformen laden dieselbe Web-App.

## App Store Connect Angaben

### Untertitel (max. 30 Zeichen)

Punkte, Rally, Team-Duell

(26 Zeichen)

### Werbetext / Promotional Text (max. 170 Zeichen, jederzeit ohne Review aenderbar)

Tischtennis zaehlen: Punkte, Rally per Kamera/Ton/Tippen, Team-Duell, Sprachsteuerung - direkt an der
Platte nutzbar.

### Beschreibung (max. 4000 Zeichen)

Gleicher Text wie die lange Beschreibung in `android/PLAY_STORE_CHECKLIST.md` kann uebernommen werden
(Apple hat kein eigenes Format, nur ein hoeheres Zeichenlimit).

### Keywords (max. 100 Zeichen, kommagetrennt, nicht sichtbar fuer Nutzer)

tischtennis,pingpong,zaehler,scoreboard,punkte,ballwechsel,rally,training,verein,duell,team

(einzelne Woerter zaehlen, keine Leerzeichen noetig - anders als Play Store Keywords)

### Support-URL (Pflichtfeld)

Noch festzulegen - z.B. GitHub-Repo-Issues-Seite oder eigene Support-Seite mit info@blitzreich.de.

## App Privacy (Nutrition Label)

Fragebogen in App Store Connect unter App Privacy:

- Kamera-/Mikrofon-Zugriff: **"Data Not Collected"** waehlbar, da Kamera-/Mikrofondaten
  ausschliesslich lokal auf dem Geraet verarbeitet und nie an AppReich oder Dritte uebertragen werden.
- Keine Konten, kein Tracking, keine Analytics/Werbe-SDKs -> durchgehend "Data Not Collected".
- LocalStorage-Einstellungen (Namen, Sound, Hinweise, zuletzt genutzter Modus) verlassen das Geraet
  nicht -> ebenfalls "Data Not Collected".

## Export Compliance

- Nutzt nur Standard-HTTPS, keine eigene/proprietaere Verschluesselung.
- Bei der Upload-Frage "Does your app use encryption?" die Ausnahme fuer Standardverschluesselung
  waehlen (in Xcode/Info.plist: `ITSAppUsesNonExemptEncryption = false`), damit die Frage nicht bei
  jedem Build erneut erscheint.

## Altersfreigabe

Age Rating Fragebogen in App Store Connect ausfuellen - erwartungsgemaess 4+ (keine anstoessigen
Inhalte, kein Nutzer-generierter Content mit Chat/Sharing).

## Testplan TestFlight

Gleicher Testplan wie Android Internal Testing (siehe `android/PLAY_STORE_CHECKLIST.md`
"Testplan Internal Testing"), zusaetzlich:

- App startet im echten Vollbild ohne Browser-/Safari-Leiste (WKWebView-Wrapper statt "Zum
  Home-Bildschirm").
- Safe-Area/Notch: Inhalte werden nicht von Dynamic Island, Notch oder Home-Indicator verdeckt.
- Kamera-/Mikrofon-Berechtigungsdialog zeigt die deutschen Verwendungszweck-Texte (siehe README.md).

## Noch offen (bevor App Store Upload)

- [ ] Apple Developer Program Mitgliedschaft anlegen (99 $/Jahr).
- [ ] Bundle-ID in App Store Connect reservieren.
- [ ] iOS-Screenshots in Apples Pflichtgroessen erstellen (z.B. 1290x2796 fuer 6.7"/6.9"-iPhones;
      bestehende 1236x2676-Android-Screenshots passen nicht direkt).
- [ ] Support-URL festlegen und eintragen.
- [ ] Datenschutzerklaerung (`android/PRIVACY_POLICY_DRAFT.md`) veroeffentlichen und URL in App Store
      Connect eintragen (Apple verlangt sie zwingend, auch bei "Data Not Collected").
- [ ] PWABuilder iOS-Paket generieren, auf einem Mac (eigenes Geraet oder Cloud-Mac-Dienst) bauen und
      signieren.
- [ ] App Privacy Fragebogen ausfuellen (siehe Abschnitt oben).
- [ ] Export-Compliance-Angabe setzen.
- [ ] Altersfreigabe-Fragebogen ausfuellen.
- [ ] Build via TestFlight testen (Testplan siehe oben), danach zur Review einreichen.
