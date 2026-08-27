# iOS / App Store Vorbereitung

Die Web-App bleibt die Hauptversion. Fuer den App Store gibt es (anders als bei Android) keine
TWA-Technik von Apple - der Weg ist ein natives WKWebView-Wrapper-Projekt, das die bestehende PWA
laedt. Wie beim Android-Paket wird dafuer [PWABuilder](https://www.pwabuilder.com/) genutzt, das
denselben Xcode-Wrapper (Capacitor-basiert) generiert, den auch Bubblewrap/PWABuilder fuer andere
Plattformen nutzt.

**Wichtiger Unterschied zu Android:** Der Android-Build (AAB) kann direkt aus PWABuilder heruntergeladen
und signiert hochgeladen werden. Fuer iOS erzeugt PWABuilder nur das Xcode-Projekt (Zip) - das
tatsaechliche Bauen, Signieren und Hochladen in den App Store **muss auf einem Mac mit Xcode**
passieren (Apple erlaubt keine Windows-Toolchain). Ohne eigenen Mac: Cloud-Mac-Dienst (z.B. MacinCloud)
oder CI mit macOS-Runner (z.B. Codemagic, GitHub Actions `macos-latest`) verwenden.

## iOS-Daten

- App-Name: Ping Pong Counter
- Bundle-ID (Vorschlag): `de.pingpongcounter.app` - folgt dem `de.<appname>.app`-Schema, das schon
  fuer eine andere App im selben Apple-Developer-Account verwendet wird. Muss vor dem ersten Build in
  App Store Connect reserviert werden, Aenderung danach nicht mehr moeglich.
- Web Manifest: https://schmidi321.github.io/pingpong-tracker/manifest.json
- Start-URL: https://schmidi321.github.io/pingpong-tracker/
- Orientation: portrait
- Apple Developer Program: **bereits aktiv** (der Account wird bereits fuer eine andere App
  genutzt). Die Mitgliedschaft (99 $/Jahr) haengt am Account, nicht an der einzelnen App - fuer
  Ping Pong Counter faellt keine zweite Gebuehr an, es muss nur eine neue Bundle-ID/App im selben
  Account angelegt werden.

## Uebertragbare Erkenntnisse aus einer anderen App im selben Account

Ein Abgleich (rein lesend, keine Aenderungen dort) mit einer anderen, bereits im App Store
vorbereiteten App desselben Entwicklerkontos ergab technisch einen anderen Stack (natives
Cloud-Build statt PWABuilder/Xcode) - Code/Build-Pipeline lassen sich nicht direkt uebernehmen.
Diese Punkte sind trotzdem uebertragbar:

- Bundle-ID-Schema `de.<appname>.app`.
- `ITSAppUsesNonExemptEncryption: false` fuer die Export-Compliance-Frage - deckt sich mit der
  Empfehlung unten.
- Apple-Developer-Account ist derselbe wie oben beschrieben, keine neue Mitgliedschaft noetig.
- Rechtliches (Impressum + Datenschutzerklaerung) wird dort live auf einem eigenen Server gehostet
  (eigene Routen dafuer). Ping Pong Counter hat bisher nur den Entwurf
  `android/PRIVACY_POLICY_DRAFT.md`, aber **noch keine oeffentlich erreichbare URL** - die braucht
  Apple zwingend im App-Privacy-Formular (siehe Checkliste, "Noch offen"). Ein Impressum ist in
  Deutschland ueblich, wenn eine App Spenden/Support-Links enthaelt (PayPal.Me) - lohnt sich, vor dem
  Upload zu klaeren, ob eins noetig ist.
- Keine lokal abgelegten Apple-Zertifikate/Keys gefunden - liegen bei der anderen App in der Cloud
  des Build-Dienstes, nichts lokal zum Uebernehmen.

## PWA-Seite: bereits erledigt

Die fuer iOS relevanten Meta-Tags und Icons stehen schon in [`index.html`](../index.html) und
[`manifest.json`](../manifest.json), muessen fuer das Paket nicht mehr geaendert werden:

- `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` (black-translucent),
  `apple-mobile-web-app-title`
- `apple-touch-icon` (icons/icon-180.png, 180x180)
- Manifest-Icons 192/512/512-maskable vorhanden

## Build-Weg mit PWABuilder

1. Auf [pwabuilder.com](https://www.pwabuilder.com/) die Live-URL eingeben (wie beim Android-Paket).
2. Unter "Package for stores" **iOS** auswaehlen statt Android.
3. Im iOS-Formular angeben:
   - Bundle-ID (siehe oben)
   - App-Name, Version/Build-Nummer
   - Status-Bar-Stil, unterstuetzte Ausrichtung (portrait)
   - Berechtigungs-Texte fuer Kamera/Mikrofon (siehe unten - Apple verlangt diese Strings, sonst
     lehnt Xcode den Build/Review ab)
4. Generiertes Xcode-Projekt (Zip) herunterladen, auf einem Mac entpacken.
5. Dort `pod install` ausfuehren (Capacitor/Cordova-Abhaengigkeiten), Projekt in Xcode oeffnen.
6. In Xcode: Team/Signing (Apple-Developer-Account) hinterlegen, Bundle-ID bestaetigen.
7. Product > Archive, dann ueber Xcode Organizer oder Transporter zu App Store Connect hochladen.

## Benoetigte Berechtigungs-Texte (Info.plist / PWABuilder-Formular)

Apple verlangt fuer Kamera/Mikrofon je einen menschenlesbaren Verwendungszweck (analog zu den
Android-Berechtigungshinweisen in `android/PLAY_STORE_CHECKLIST.md`):

- **NSCameraUsageDescription**: "Wird fuer die Ballwechsel-Erkennung per Kamera benoetigt."
- **NSMicrophoneUsageDescription**: "Wird fuer Sprachsteuerung und die Ballwechsel-Erkennung per Ton
  benoetigt."

## Bekannte Stolpersteine

- **Guideline 4.2 (Minimum Functionality):** Apple prueft strenger als Google, ob eine gewrappte
  Website als App durchgeht. Offline-Faehigkeit (Service Worker), Kamera/Mikro-Erkennung, Bluetooth-
  Fernbedienung und die TV-Zweitbildschirm-Funktion sprechen dafuer, sollten im Review-Notizfeld aber
  explizit erwaehnt werden, falls ein Reviewer nachfragt.
- **Export-Compliance:** Die App nutzt nur Standard-HTTPS, keine eigene Verschluesselung -> bei der
  Frage "Does your app use encryption?" die Ausnahme fuer Standardverschluesselung waehlen
  (`ITSAppUsesNonExemptEncryption = false`), dann entfaellt die Nachfrage bei jedem Upload.
- **App Privacy (Nutrition Label):** Kamera-/Mikrofondaten werden ausschliesslich lokal verarbeitet
  und nie uebertragen -> in App Store Connect kann "Data Not Collected" gewaehlt werden (siehe
  Checkliste).
- **Screenshots:** Die vorhandenen Android-Screenshots (1236x2676) passen nicht zu Apples
  Pflichtformaten fuer iPhone (z.B. 1290x2796 fuer 6.7"/6.9"-Geraete). Neue Screenshots in Apples
  Groessen noetig, siehe Checkliste.

## Ergaenzende Unterlagen

- APP_STORE_CHECKLIST.md: App-Store-Connect-Texte, Testplan, aktueller Funktionsumfang und offene Punkte.
- Datenschutzerklaerung: siehe `android/PRIVACY_POLICY_DRAFT.md` (plattformneutral, gilt auch fuer iOS).
