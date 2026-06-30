# Play Store Checkliste - Ping Pong Counter

## Technische App-Daten

- App-Name: Ping Pong Counter
- Entwickler/Brand: AppReich
- Paketname: `de.appreich.pingpongcounter`
- App-Typ: Trusted Web Activity (TWA) fuer die bestehende PWA
- Start-URL: feste HTTPS-Domain der Web-App
- Zielgruppe: Tischtennis-Spieler, Trainer, Vereine, Hobbygruppen
- Kategorie: Sport / Tools

## Vor dem Build klaeren

- Finale HTTPS-Domain festlegen.
- `manifest.json` auf dieser Domain erreichbar machen.
- Service Worker und Offline-Start testen.
- Kamera und Mikrofon in der Browser-Version auf Android testen.
- App-Icon und Screenshots finalisieren.
- Datenschutzerklaerung als oeffentliche URL bereitstellen.

## Play Console Angaben

### Kurzbeschreibung

Tischtennis zaehlen: Punkte, Sprache und Ballwechsel per Kamera, Ton oder Tippen.

### Lange Beschreibung

Ping Pong Counter ist ein einfacher Tischtennis-Zaehler fuer Training, Hobbyspiel und Verein. Zaehle Punkte per Tippen oder Sprache und erfasse Ballwechsel per Kamera, Ton oder manuell. Die App ist schnell gestartet, uebersichtlich und fuer den Einsatz direkt an der Platte gedacht.

Funktionen:
- Punktestand fuer zwei Spieler
- Sprachsteuerung mit Blau/Orange
- Rally-Zaehler per Kamera, Ton oder Tippen
- Bestwert, letzter Ballwechsel und Runden
- Meilensteine mit Animation und Sound
- freiwillige Unterstuetzung per PayPal.Me ohne Freischaltung oder Gegenleistung

### Keywords intern

Tischtennis, Ping Pong, Zaehler, Scoreboard, Punkte, Ballwechsel, Rally, Training, Verein

## Datenschutz / Berechtigungen

Voraussichtlich relevante Berechtigungen:
- Kamera: nur fuer Rally-Erkennung per Kamera
- Mikrofon: fuer Sprachsteuerung und Rally-Erkennung per Ton

Hinweis fuer Data Safety:
- Kamera-/Mikrofondaten werden lokal im Browser verarbeitet.
- Keine Anmeldung in der Basisversion.
- Keine Weitergabe von Kamera-/Mikrofondaten.
- LocalStorage speichert Einstellungen wie Namen, Sound und Hinweise lokal auf dem Geraet.

## TWA / Digital Asset Links

1. Release-Key erzeugen oder vorhandenen Play-App-Signing-Fingerprint verwenden.
2. SHA-256 Fingerprint in `.well-known/assetlinks.json` eintragen.
3. Datei unter `https://<domain>/.well-known/assetlinks.json` bereitstellen.
4. TWA im internen Test pruefen: startet fullscreen ohne Browser-Leiste.

## Testplan Internal Testing

- App startet offline nach erstem Laden.
- Punkte: Tippen auf beide Spieler zaehlt korrekt.
- Punkte: Mikrofon startet/stoppt, Blau/Orange zaehlt korrekt.
- Rally Kamera: Berechtigung, Start/Stopp, Anzeige bleibt auf einer Seite.
- Rally Ton: erster Aufschlag-Impuls wird ignoriert, danach wird sauber gezaehlt.
- Rally Tippen: Start, Tippen, Reset.
- Einstellungen: Sound/Hinweise an und aus.
- Support/PayPal.Me Link oeffnet korrekt.

## Noch offen

- Finale Domain eintragen.
- Finale Screenshots aus aktueller UI erstellen.
- Datenschutzerklaerung veroeffentlichen.
- Assetlinks mit echtem SHA-256 erzeugen.
- AAB mit Bubblewrap bauen und im internen Test hochladen.