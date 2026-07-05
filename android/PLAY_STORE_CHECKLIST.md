# Play Store Checkliste - Ping Pong Counter

## Technische App-Daten

- App-Name: Ping Pong Counter
- Entwickler/Brand: AppReich
- Paketname: `de.appreich.pingpongcounter`
- App-Typ: Trusted Web Activity (TWA) fuer die bestehende PWA
- Live-Domain: https://schmidi321.github.io/pingpong-tracker/ (bereits live, HTTPS, Service Worker aktiv)
- Zielgruppe: Tischtennis-Spieler, Trainer, Vereine, Hobbygruppen
- Kategorie: Sport / Tools
- Signing-Key: bereits erstellt (PWABuilder), Alias `pingpongcounter`, Keystore offline auf USB-Stick gesichert -
  NICHT ins Repo einchecken

## Aktueller Funktionsumfang (Stand: Juli 2026)

- Punktezaehler fuer zwei Spieler, Tippen oder Sprachsteuerung ("blau"/"orange")
- Rally-/Ballwechsel-Zaehler per Kamera, Ton oder Tippen
- Team-Duell: zwei Teams treten abwechselnd gegeneinander an (waehlbare Rundenzahl und Zeit je Team),
  funktioniert in allen drei Erkennungsmodi, mit grafischem Ergebnisvergleich am Ende
- Challenge-Modus: Zeitlimit (1/2/3/5 Min) mit Highscore-Tracking je Zeitfenster
- Meilenstein-Animationen alle 25 Treffer, Sprachansage alle 50
- SixSeven-Moment: optionale Animation bei Punktestand 6:7 / 7:6 (standardmaessig aus, in Einstellungen aktivierbar)
- TV-/Zweitbildschirm-Anzeige per BroadcastChannel (kein echtes Screen-Mirroring, siehe Hinweis unten)
- Bluetooth-Kopfhoerer-Taste als Fernbedienung (Media Session API)
- Merkt sich den zuletzt verwendeten Rally-Erkennungsmodus
- Neues App-Icon/Splash-Screen ("67"-Design: Schlaeger, Ball, Ping-Pong-Branding)
- Support-/Spenden-Link (PayPal.Me), keine Freischaltung oder Gegenleistung

## Play Console Angaben

### Kurzbeschreibung (max. 80 Zeichen)

Tischtennis zaehlen: Punkte, Rally per Kamera/Ton/Tippen, Team-Duell, Sprachsteuerung.

(79 Zeichen)

### Lange Beschreibung

Ping Pong Counter ist der Tischtennis-Begleiter fuer Training, Hobbyspiel und Verein - schnell gestartet, uebersichtlich, direkt an der Platte nutzbar.

PUNKTE ZAEHLEN
- Punktestand fuer zwei Spieler per Tippen
- Sprachsteuerung: einfach "blau" oder "orange" sagen
- Saetze, Aufschlagwechsel und Matchstand automatisch im Blick
- Optionaler "SixSeven"-Moment bei 6:7/7:6 zum Spass zwischendurch

BALLWECHSEL ZAEHLEN (RALLY)
- Automatische Erkennung per Kamera oder Mikrofon - oder einfach per Tippen
- Bestwert, letzter Ballwechsel und Rundenzahl auf einen Blick
- Meilenstein-Animationen und Sprachansagen bei runden Zahlen
- Zeit-Challenge mit Highscore: wie viele Ballwechsel schaffst du in 1, 2, 3 oder 5 Minuten?

TEAM-DUELL
- Zwei Teams treten abwechselnd in mehreren Runden gegeneinander an
- Funktioniert per Kamera, Ton oder Tippen - Teamnamen, Rundenzahl und Zeit frei waehlbar
- Grafischer Vergleich mit Balkendiagramm am Ende zeigt den Sieger

WEITERE FUNKTIONEN
- TV-/Zweitbildschirm-Anzeige fuer eine grosse Zaehler-Ansicht
- Bluetooth-Kopfhoerer-Taste als Fernbedienung
- Funktioniert offline nach dem ersten Laden
- Keine Anmeldung, keine Werbung, keine Kontosammlung

Ping Pong Counter wird von AppReich entwickelt und staendig weiter verbessert. Feedback ist jederzeit willkommen.

### Keywords intern

Tischtennis, Ping Pong, Zaehler, Scoreboard, Punkte, Ballwechsel, Rally, Training, Verein, Duell, Team

## Datenschutz / Berechtigungen

Relevante Berechtigungen:
- Kamera: nur fuer Rally-/Duell-Erkennung per Kamera
- Mikrofon: fuer Sprachsteuerung und Rally-/Duell-Erkennung per Ton

Hinweis fuer Data Safety Form:
- Kamera-/Mikrofondaten werden ausschliesslich lokal im Browser/der App verarbeitet, keine Uebertragung an einen Server.
- Keine Anmeldung/kein Konto in der App.
- Keine Weitergabe von Kamera-/Mikrofon-/Nutzungsdaten an Dritte.
- LocalStorage speichert Einstellungen (Namen, Sound, Hinweise, zuletzt genutzter Modus) nur lokal auf dem Geraet.

## TWA / Digital Asset Links

1. Signing-Key existiert bereits (PWABuilder-Export) - Alias `pingpongcounter`, Fingerprint siehe eigene Notizen (nicht im Repo).
2. **Bekanntes offenes Problem:** Die Browser-URL-Leiste erscheint noch in der TWA statt echtem Fullscreen.
   Ursache: `assetlinks.json` enthaelt vermutlich nur den Upload-Key-Fingerprint, aber Google signiert die
   Store-Version mit einem eigenen "Play App Signing"-Zertifikat. Fix: in der Play Console unter
   *Setup > App-Integritaet > App-Signaturschluessel-Zertifikat* den zweiten SHA-256-Fingerprint holen und
   zusaetzlich (als weiteren Eintrag) in `.well-known/assetlinks.json` eintragen.
3. Datei muss unter `https://schmidi321.github.io/.well-known/assetlinks.json` erreichbar sein
   (Achtung: GitHub Pages Projekt-Seiten liegen unter `/pingpong-tracker/` - `.well-known` muss auf
   Domain-Root, ggf. eigene Domain oder GitHub Pages User-Site noetig).
4. Nach Fix: TWA im internen Test pruefen - muss fullscreen ohne Browser-Leiste starten.

## Testplan Internal Testing

- App startet offline nach erstem Laden.
- Punkte: Tippen auf beide Spieler zaehlt korrekt, Sprachsteuerung "blau"/"orange" funktioniert.
- Rally Kamera: Berechtigung, Start/Stopp, Anzeige bleibt auf einer Seite.
- Rally Ton: erster Aufschlag-Impuls wird ignoriert, danach sauberes Zaehlen.
- Rally Tippen: Start, Tippen, Reset.
- Team-Duell: Setup, Team-Wechsel, Ergebnis-Anzeige in allen drei Modi.
- Challenge-Modus: Zeitlimit laeuft ab, Highscore wird gespeichert.
- Einstellungen: Sound/Hinweise/SixSeven an und aus, TV-Anzeige oeffnet.
- Support/PayPal.Me Link oeffnet korrekt.

## Noch offen (bevor Play Store Upload)

- [x] Telefon-Screenshots fertig (1236x2676px, ueber der 1080px-Mindestgroesse fuer Bewerbung):
      screen-score.png, screen-rally.png, screen-duel-active.png, screen-duel-result.png.
- [x] Tablet-Screenshots fertig: tablet-7.png (1200x1920) und tablet-10.png (1600x2560).
- [x] Feature-Grafik 1024x500 fuer die Store-Listing-Seite (feature-graphic.png).
- [ ] Datenschutzerklaerung (`PRIVACY_POLICY_DRAFT.md`) veroeffentlichen und URL in Play Console eintragen.
- [ ] assetlinks.json um Play-App-Signing-Fingerprint ergaenzen (siehe TWA-Abschnitt oben) - behebt die
      sichtbare Browser-URL-Leiste.
- [ ] Google Play Console Account/App-Eintrag anlegen (falls noch nicht geschehen), Kategorie + Zielgruppe +
      Altersfreigabe-Fragebogen ausfuellen.
- [ ] Data Safety Form in der Play Console ausfuellen (Inhalte siehe Abschnitt oben).
- [ ] Signiertes AAB (aus PWABuilder-Export) im internen Test hochladen und TWA-Start pruefen.
