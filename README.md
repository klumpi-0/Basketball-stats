# 🏀 Basketball Stats

Eine einfache Web-App, mit der man bei Spielen die Statistiken der eigenen Mannschaft erfasst.

**Was erfasst wird**
- Würfe: 1P (Freiwurf), 2P und 3P, jeweils Treffer und Fehlwurf
- Assists
- Offensiv- und Defensiv-Rebounds
- Spielzeit pro Spieler (Uhr starten/pausieren, Spieler mit „↑ Feld“ bzw. „↓ Bank“ ein- und auswechseln)
- Gegnerpunkte (+1 / +2 / +3) für den Spielstand

**Weitere Funktionen:** Viertel/Verlängerung, Rückgängig-Knopf, Box-Score mit Trefferquoten,
CSV-Export für Excel, Spielverlauf, Backup als JSON (Export/Import), offline nutzbar und
installierbar („Zum Home-Bildschirm hinzufügen“).

Die Daten werden **nur im Browser des Geräts** gespeichert (localStorage). Es gibt keinen Server.
Mit „Backup exportieren“ kannst du sie sichern oder auf ein anderes Gerät übertragen.

## Bedienung im Spiel
1. Unter **Kader** die Spieler mit Nummer und Namen anlegen (nur einmal nötig).
2. **Neues Spiel**: Gegner eintragen, die Spieler für das Spiel anhaken, „Spiel starten“.
3. Die Starting Five mit „↑ Feld“ aufs Feld setzen und **▶ Start** drücken, sobald die Spieluhr läuft.
   Bei Unterbrechungen **⏸ Pause** drücken. Die Spielzeit zählt nur, während die Uhr läuft.
4. Für eine Aktion zuerst den **Spieler antippen**, dann die Aktion unten (z. B. „2P ✓“).
5. Unter **📊 Statistik** steht jederzeit der Box-Score.

## Hosting mit GitHub Pages
1. Auf GitHub ein neues Repository anlegen (z. B. `basketball-stats`).
2. Die Dateien dieses Ordners hochladen (per „Add file → Upload files“ oder `git push`).
3. Im Repository unter **Settings → Pages** bei *Source* „Deploy from a branch“ wählen,
   Branch `main` und Ordner `/ (root)` einstellen und speichern.
4. Nach ca. 1 Minute ist die App erreichbar unter `https://<dein-name>.github.io/basketball-stats/`.

Lokal ausprobieren: einfach `index.html` im Browser öffnen.
