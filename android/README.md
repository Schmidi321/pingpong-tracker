# Android / Play Store Vorbereitung

Die Web-App bleibt die Hauptversion. Fuer den Play Store laeuft die App als Trusted Web Activity (TWA): Android startet dabei die bestehende PWA fullscreen, ohne die Browser-Leiste.

## Android-Daten (aktuell)

- App-Name: Ping Pong Counter
- Package-Name: de.appreich.pingpongcounter
- Web Manifest: https://schmidi321.github.io/pingpong-tracker/manifest.json
- Start-URL: https://schmidi321.github.io/pingpong-tracker/
- Orientation: portrait
- Signing-Key bereits erzeugt (Alias `pingpongcounter`), Keystore offline gesichert - nicht ins Repo einchecken.

## Build-Weg mit PWABuilder

Der Android-Build laeuft ueber [PWABuilder](https://www.pwabuilder.com/) (nicht Bubblewrap):

1. Web-App auf der HTTPS-Domain deployen (bereits erledigt via GitHub Pages).
2. Auf pwabuilder.com die Live-URL eingeben, Android-Paket generieren lassen.
3. `versionCode`/`versionName` bei jedem neuen Release hochzaehlen.
4. Mit dem vorhandenen Keystore (Alias `pingpongcounter`) signieren - niemals mit neuem Key, sonst lehnt
   Play den Upload als "andere App" ab.
5. SHA-256-Fingerprint des Upload-Keys **und** den Play-App-Signing-Fingerprint (aus der Play Console,
   Setup > App-Integritaet) in `.well-known/assetlinks.json` eintragen (siehe PLAY_STORE_CHECKLIST.md,
   Abschnitt "TWA / Digital Asset Links" - aktuell noch offen, verursacht die sichtbare URL-Leiste).
6. Im Play Console Internal Testing hochladen und TWA-Start pruefen (muss fullscreen ohne Browser-Leiste sein).

## Hinweise

- Kamera/Mikro brauchen HTTPS und die normalen Browser-Berechtigungen.
- Wenn Digital Asset Links nicht vollstaendig stimmen, zeigt Android weiterhin die Browser-URL-Leiste statt
  einer echten fullscreen TWA.
- Screenshots liegen in `screenshots/` (screen-score.png, screen-rally.png) - fuer den Store-Upload noch
  durch aktuelle, finale Aufnahmen ersetzen (siehe Checkliste, "Noch offen").

## Ergaenzende Unterlagen

- PLAY_STORE_CHECKLIST.md: Play-Console-Texte, Testplan, aktueller Funktionsumfang und offene Punkte.
- PRIVACY_POLICY_DRAFT.md: Entwurf fuer die Datenschutzseite.
