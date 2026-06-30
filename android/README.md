# Android / Play Store Vorbereitung

Die Web-App bleibt die Hauptversion. Fuer den Play Store ist eine Trusted Web Activity (TWA) sinnvoll: Android startet dabei die bestehende PWA fullscreen, ohne die Browser-Leiste.

## Geplante Android-Daten

- App-Name: Ping Pong Counter
- Package-Name: de.appreich.pingpongcounter
- Web Manifest: https://<deine-domain>/manifest.json
- Start-URL: https://<deine-domain>/
- Orientation: portrait

## Build-Weg mit Bubblewrap

1. Web-App auf eine feste HTTPS-Domain deployen.
2. Lighthouse/PWA-Check laufen lassen: Manifest, Service Worker, Icons, HTTPS.
3. Bubblewrap installieren:

```powershell
npm i -g @bubblewrap/cli
```

4. Android-Projekt erzeugen:

```powershell
bubblewrap init --manifest=https://<deine-domain>/manifest.json
```

5. Beim Init als Package-Name `de.appreich.pingpongcounter` verwenden.
6. App Bundle bauen:

```powershell
bubblewrap build
```

7. SHA-256-Fingerprint aus dem Release-Key in `.well-known/assetlinks.json` eintragen.
8. `.well-known/assetlinks.json` auf derselben HTTPS-Domain deployen.
9. Im Play Console Internal Testing hochladen und TWA-Verifikation pruefen.

## Hinweise

- Kamera/Mikro brauchen HTTPS und die normalen Browser-Berechtigungen.
- Wenn Digital Asset Links nicht stimmen, startet Android die Seite als Custom Tab statt als echte fullscreen TWA.
- Fuer Play Store Screenshots koennen die vorhandenen `screenshots/screen-score.png` und `screenshots/screen-rally.png` als Grundlage dienen.