# Benachrichtigungen einrichten (iPhone und Android, Schritt für Schritt)

Seit Version 1.55 bekommen Spieler eine Benachrichtigung aufs Handy, wenn

- ein Freund ihnen eine **private Nachricht** schreibt,
- jemand im **Weltchat** schreibt (höchstens eine alle 10 Minuten je Spieler),
- jemand sie **zum Kampf einlädt**.

Das klappt auch, wenn Snake gerade zu ist. Alles ist kostenlos. Dauer: ca. 30 Minuten, davon 10 für Android.

Was die Spieler davon sehen, steht unten in [Teil 6](#teil-6-was-die-spieler-sehen).

## Teil 0: Was läuft wo

| Gerät | Wie die Benachrichtigung ankommt | Was du einrichten musst |
|---|---|---|
| **iPhone / iPad** (Web-App vom Home-Bildschirm, ab iOS 16.4) | Web Push über Apple | Teil 1 und 2 |
| **Android, Web-App** (aus Chrome zum Startbildschirm hinzugefügt) | Web Push über Google | Teil 1 und 2 |
| **Android, APK** (aus *Releases*) | Firebase Cloud Messaging (Google) | Teil 1, 2 und 3 |
| Computer (Chrome, Edge, Firefox) | Web Push | Teil 1 und 2 |

Wichtig fürs **iPhone**: Du brauchst **kein Apple-Entwicklerkonto** und keinen App Store. Benachrichtigungen gehen dort
aber nur, wenn Snake **vom Home-Bildschirm** geöffnet wird (Safari → Teilen → „Zum Home-Bildschirm“), nicht im
normalen Safari-Tab. Das zeigt die App den Spielern ohnehin schon bei der Installation.

Der Weg einer Benachrichtigung: Spieler A schreibt → die App sagt dem **Snake-Server** (Cloudflare) Bescheid →
der fragt **Supabase**, wer benachrichtigt werden darf (Einstellungen, stumm, gesperrt) → der Server schickt die
Benachrichtigung an Apple, Google oder Firebase → sie erscheint auf dem Handy von Spieler B.

## Teil 1: Datenbank ergänzen (Supabase)

Neu sind der Weltchat und die Einstellungen der Benachrichtigungen (Datei
`supabase/migrations/20261030000000_weltchat_benachrichtigungen.sql`).

- **Hast du die automatischen Datenbank-Updates eingerichtet** (die drei Supabase-Secrets aus
  [`ONLINE-EINRICHTEN.md`](ONLINE-EINRICHTEN.md), Schritt 8): Dann passiert das nach dem Merge von selbst.
  Kontrolle: GitHub → **Actions** → **Supabase-Datenbank** → der letzte Lauf ist grün.
- **Sonst, von Hand:** Supabase → **SQL Editor** → **New snippet** → den kompletten Inhalt von
  `supabase/NACHHOLEN.sql` hineinkopieren → **Run** → „Success“. Das lässt sich gefahrlos wiederholen.

Prüfen: Inhalt von `supabase/SELBSTTEST.sql` im SQL Editor ausführen. Jede Zeile soll „ok“ zeigen, auch
`weltchat`, `push_nachricht`, `push_welt` und `push_einstellung_setzen`.

Ohne diesen Teil gibt es in der Hall of Snakes keine Weltchat-Leiste, und Benachrichtigungen kommen nur bei Einladungen.

## Teil 2: Web Push (iPhone und Android-Web-App)

**Hast du schon „Einladungen aufs Handy“ eingerichtet** ([`MEHRSPIELER-EINRICHTEN.md`](MEHRSPIELER-EINRICHTEN.md),
Schritt 7)? Dann ist dieser Teil fertig, spring zu Schritt 2.4. Sonst:

### 2.1 Schlüssel erzeugen

1. GitHub → Repo `kortjannis-web/Snake` → grüner Knopf **Code** → Reiter **Codespaces** → **Create codespace on main**.
   (Oder an deinem Computer im Repo-Ordner.)
2. Unten im Terminal nacheinander eingeben:

   ```bash
   npm install
   ```

   ```bash
   npm run vapid
   ```

3. Es erscheinen zwei Werte: ein **öffentlicher** Schlüssel (lang, beginnt mit `B`) und ein **geheimer**.

> Den geheimen Schlüssel niemandem schicken und nicht in einen Chat kopieren. Er gehört nur in die GitHub-Secrets.
> Die Schlüssel nur **einmal** erzeugen: Neue Schlüssel machen alle bisherigen Abos ungültig.

### 2.2 In GitHub eintragen

GitHub → **Settings** → **Secrets and variables** → **Actions**:

| Reiter | Name | Wert |
|---|---|---|
| **Variables** → New repository variable | `VITE_VAPID_PUBLIC_KEY` | der **öffentliche** Schlüssel |
| **Secrets** → New repository secret | `VAPID_PRIVATE_KEY` | der **geheime** Schlüssel |

Außerdem müssen schon da sein (vom Mehrspieler): Secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
Variablen `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SNAKE_SERVER`.

### 2.3 Neu veröffentlichen

GitHub → **Actions**, jeweils links den Namen anklicken → rechts **Run workflow** → **Run workflow**, in dieser Reihenfolge:

1. **Snake-Server (Cloudflare)** (der Server bekommt die Schlüssel), warten bis grün.
2. **Web-App (GitHub Pages)**.

### 2.4 Ausprobieren

1. Snake auf dem Handy vom Home-Bildschirm öffnen (Web-App, nicht die APK).
2. Die App fragt einmal „Benachrichtigungen aktivieren?“ → **Ja, aktivieren** → im System **Erlauben**.
   (Kam die Frage nicht: **Optionen** → **Benachrichtigungen** einschalten.)
3. Snake schließen. Ein Freund schreibt dir in der Hall of Snakes im Chat oder lädt dich ein.
   Nach wenigen Sekunden kommt die Benachrichtigung.

## Teil 3: Android-App (APK) mit Firebase

Die APK kann kein Web Push. Dafür gibt es Firebase Cloud Messaging (kostenlos, ohne Kreditkarte). Ohne diesen Teil
läuft die APK normal weiter, Benachrichtigungen kommen dort dann nur, solange Snake offen ist. Die Web-App auf
Android geht auch ohne Firebase (Teil 2).

### 3.1 Firebase-Projekt anlegen

1. <https://console.firebase.google.com> öffnen und mit einem Google-Konto anmelden.
2. **Projekt erstellen** (bzw. *Create a project*) → Name z. B. `snake-endlos` → Google Analytics **ausschalten**
   (brauchst du nicht) → **Projekt erstellen** → **Weiter**.

### 3.2 Android-App hinzufügen und google-services.json laden

1. Auf der Projektseite oben auf das **Android-Symbol** (bzw. **App hinzufügen** → Android).
2. **Android-Paketname:** genau `de.topsichtbar.snake` (muss stimmen, sonst baut die APK nicht).
   Spitzname: `Snake`. Das Feld „SHA-1“ leer lassen.
3. **App registrieren** → **google-services.json herunterladen**. Die restlichen Schritte des Assistenten
   (Gradle usw.) einfach mit **Weiter** überspringen, das ist im Repo schon erledigt.
4. Die Datei mit einem Texteditor öffnen und den **ganzen Inhalt** kopieren.
   (Am Handy: in der Dateien-App antippen, „Teilen“ → in eine Notiz-App, dort alles markieren und kopieren.)
5. GitHub → **Settings** → **Secrets and variables** → **Actions** → Reiter **Secrets** → **New repository secret**:
   Name `GOOGLE_SERVICES_JSON`, Wert der komplette Inhalt der Datei (beginnt mit `{` und endet mit `}`).

### 3.3 Dienstkonto für den Server

Damit der Snake-Server Benachrichtigungen an die APK schicken darf:

1. Firebase → links oben das **Zahnrad** → **Projekteinstellungen** → Reiter **Dienstkonten** (*Service accounts*).
2. **Neuen privaten Schlüssel generieren** → **Schlüssel generieren**. Es lädt eine JSON-Datei herunter.
3. Den **ganzen Inhalt** dieser Datei kopieren (wie oben).
4. GitHub → **Secrets** → **New repository secret**: Name `FCM_DIENSTKONTO`, Wert der komplette Inhalt.

> Diese Datei ist ein Passwort für dein Firebase-Projekt: nur in das GitHub-Secret, nirgends sonst hin,
> danach am besten vom Computer/Handy löschen.

5. Kontrolle (meist schon so): Projekteinstellungen → Reiter **Cloud Messaging** → bei
   **Firebase Cloud Messaging API (V1)** steht **Aktiviert**. Steht dort „Deaktiviert“: auf die drei Punkte →
   **In Google Cloud Console verwalten** → **Aktivieren**.

### 3.4 Neu bauen

GitHub → **Actions** → **Run workflow**, in dieser Reihenfolge:

1. **Snake-Server (Cloudflare)** (bekommt das Dienstkonto), warten bis grün.
2. **Android-APK**. Im Lauf steht beim Schritt **Firebase-Datei aus Secrets**: „Firebase eingerichtet: Benachrichtigungen an.“

Danach die neue `snake-endlos.apk` aus *Releases → latest* auf dem Android-Handy installieren (über die alte drüber).
Beim nächsten Öffnen fragt die App nach Benachrichtigungen; ab Android 13 fragt danach auch das System.

## Teil 4: Was du nach dem Merge dieser Version tun musst (Kurzfassung)

1. **Datenbank:** nichts, wenn die automatischen Updates laufen. Sonst `supabase/NACHHOLEN.sql` einmal im SQL Editor ausführen (Teil 1).
2. **iPhone und Android-Web-App:** nichts, wenn Push-Einladungen schon gingen. Sonst Teil 2.
3. **Android-APK:** Teil 3 (Firebase, zwei Secrets, Server und APK neu bauen).
4. Der Server veröffentlicht sich nach dem Merge von selbst neu (er hat sich geändert). Falls nicht:
   **Actions** → **Snake-Server (Cloudflare)** → **Run workflow**.

## Teil 5: Fehlersuche

| Was passiert | Woran es liegt | Lösung |
|---|---|---|
| In den Optionen steht „Noch nicht eingerichtet: Der Push-Schlüssel fehlt“ | Variable `VITE_VAPID_PUBLIC_KEY` fehlt beim Bauen | Teil 2.2, dann Web-App neu bauen |
| APK: „Diese Fassung der Android-App ist ohne Firebase gebaut“ | Secret `GOOGLE_SERVICES_JSON` fehlt | Teil 3.2, dann Android-APK neu bauen |
| Android-APK-Lauf rot bei „Firebase-Datei“ | Inhalt nicht komplett kopiert | Secret neu anlegen, ganzen Text von `{` bis `}` |
| Android-APK-Lauf rot bei „APK bauen“: *No matching client found for package name* | Falscher Paketname in Firebase | In Firebase eine Android-App mit genau `de.topsichtbar.snake` hinzufügen, neue google-services.json ins Secret |
| Einladen sagt „Push ist auf dem Server noch nicht eingerichtet“ | Server ohne Schlüssel | **Snake-Server (Cloudflare)** neu laufen lassen |
| iPhone: Schalter lässt sich nicht einschalten | Snake im Safari-Tab statt vom Home-Bildschirm, oder iOS älter als 16.4 | Zum Home-Bildschirm hinzufügen und von dort öffnen |
| „Blockiert. In den Einstellungen des Handys erlauben“ | Beim System einmal „Nicht erlauben“ getippt | iPhone: Einstellungen → Mitteilungen → Snake. Android: Einstellungen → Apps → Snake (bzw. Chrome) → Benachrichtigungen |
| Nachricht kommt nicht, obwohl alles an ist | Der Empfänger war gerade online (dann nur in der App), hat dich stumm geschaltet, die Art in den Optionen aus, oder es kam schon vor kurzem eine (Weltchat: 10 Minuten, Chat: 20 Sekunden je Absender) | so gewollt |
| Seit einem neuen Schlüssel kommt nichts mehr | Alte Abos passen nicht mehr | Jeder Spieler: Optionen → Benachrichtigungen aus und wieder an |

Logs vom Server: Cloudflare → **Workers & Pages** → `snake-server` → **Logs** (*Live*), dann eine Nachricht schicken.

## Teil 6: Was die Spieler sehen

- **Erster Start (neuer Spieler):** nach dem Anmelden der **Spielführer** (alle Spielfunktionen, „Weiter“ oder
  „Überspringen“), danach einmal „Benachrichtigungen aktivieren?“.
- **Alle anderen:** beim nächsten Start (angemeldet, online) einmal dieselbe Frage, sobald sonst nichts offen ist.
  Wer schon Benachrichtigungen an hat oder sie im System blockiert hat, wird nicht gefragt.
- **Hall of Snakes:** unten eine feste Leiste **Weltchat**, darin schreiben alle angemeldeten Spieler
  (Nachrichten bleiben 7 Tage, Schimpfwörter werden zu Sternchen, gesperrte Spieler sieht man nicht).
- **Roter Punkt am Knopf „Hall of Snakes“:** Zahl bei neuen privaten Nachrichten, Freundschaftsanfragen und
  verpassten Einladungen, nur ein Punkt bei Neuem im Weltchat. In der Hall dann am jeweiligen Spieler
  (Zahl am Chat-Knopf, „lädt dich zum Kampf ein“) oder an der Weltchat-Leiste.
- **Glocke oben im Chat:** im Weltchat schaltet sie den Weltchat stumm, im privaten Chat diesen einen Spieler.
  Stumm heißt: keine Benachrichtigung und kein roter Punkt am Hall-Knopf, die Nachrichten kommen trotzdem an.
- **Optionen → Benachrichtigungen:** Hauptschalter (aufs Handy ja oder nein), darunter einzeln
  **Private Nachrichten**, **Weltchat** und **Einladungen zum Kampf**. Die Einstellung gilt für den Account,
  also auf allen Geräten.
- **Tipp auf eine Benachrichtigung:** öffnet Snake direkt im passenden Chat, im Weltchat oder im Raum der Einladung.

Admin: Mit eingegebenem Admin-Passwort hat im Weltchat jede Nachricht ein kleines rotes X zum Löschen.
