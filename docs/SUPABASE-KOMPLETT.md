# Supabase komplett: einmal richtig einstellen, dann läuft es

Diese Anleitung fasst alles zusammen, was Supabase für Snake braucht: welche Schalter wie stehen müssen, wie die
Datenbank vollständig wird (mit Selbsttest), wie Änderungen künftig von selbst ankommen, wie man Fehler findet und was
für das Online-Erlebnis als Nächstes sinnvoll ist. Alles geht am Handy im Browser.

Ersteinrichtung von null: [ONLINE-EINRICHTEN.md](ONLINE-EINRICHTEN.md). Spieler löschen und fehlende Spieler:
[SPIELER-LOESCHEN.md](SPIELER-LOESCHEN.md). Mehrspieler-Server: [MEHRSPIELER-EINRICHTEN.md](MEHRSPIELER-EINRICHTEN.md).

**Reihenfolge, wenn du nur eines tust:** Teil 1 (Schalter prüfen) → Teil 2 (NACHHOLEN + Selbsttest) → Teil 4 (automatisch).
Danach musst du bei neuen Versionen nichts mehr von Hand machen.

---

## Teil 0: Was läuft wo

| Teil | Wo | Wofür |
|---|---|---|
| App (Web und Android) | GitHub Pages / GitHub Release | Spiel, Äpfel, Skins, Statistik (auf dem Gerät) |
| **Supabase Auth** | Supabase → Authentication | Konto je Name (abgeleitete E-Mail und Passwort, nie sichtbar), alte Gäste |
| **Supabase Datenbank** | Supabase → Database | Profil (Name, Skin, Silber, Freundes-Code), Ergebnisse, Siege, Freunde, Anfragen, Sperren, Chat |
| **Supabase Realtime** | Supabase → Realtime | Live-Bestenliste, Chat, Anfragen, wer ist online, Einladungen |
| Snake-Server | Cloudflare Workers | Mehrspieler-Räume, Push-Einladungen (fragt Supabase nach dem Push-Abo) |
| GitHub Variablen/Secrets | GitHub → Settings → Secrets and variables → Actions | Zugangsdaten für Bauen, Server und Datenbank-Updates |

**Wie ein Spieler online kommt (seit 1.39):** Name eingeben → die App meldet sich mit dem Konto zum Namen an (gibt es
keins, legt sie es an) → `profil_speichern` trägt Name, Skin und Silber ein und gibt den Freundes-Code zurück → der Spieler
steht in der Hall of Snakes. Klappt etwas nicht, zeigt die Hall unter dem Namen einen roten Hinweis mit dem Fehler und
**Neu verbinden**. Jede Anfrage hat ein Zeitlimit von 15 s, nichts hängt mehr bis zum Neustart.

---

## Teil 1: Alle Schalter im Dashboard (einmal prüfen, 10 Minuten)

Dashboard: <https://supabase.com/dashboard> → dein Snake-Projekt. Am Handy oben links das Menü (drei Striche).
Die Namen der Menüpunkte ändern sich bei Supabase manchmal leicht; gemeint ist jeweils der ähnlichste Punkt.

### 1.1 Authentication → Sign In / Providers

| Einstellung | Wert | Warum |
|---|---|---|
| **Allow anonymous sign-ins** | **an** | Notnagel für Geräte ohne Konto und für alte Gäste |
| **Email** (Provider) | **an** | Das Konto zum Namen ist ein E-Mail-Konto (es geht nie eine E-Mail raus) |
| **Confirm email** | **aus** | Sonst kann sich niemand per Name anmelden (Konto wartet auf Bestätigung) |
| **Secure email change** | **aus** | Sonst klappt Umbenennen nicht (die Adresse hängt am Namen) |
| **Secure password change** | **aus** | Sonst scheitert Umbenennen, wenn die Anmeldung älter als 24 h ist |
| **Allow manual linking** | **an** (schadet nicht) | Nötig, wenn später „Konto sichern“ mit Google/Apple kommt (Teil 7) |
| Minimum password length / Password requirements | Standard lassen | Die abgeleiteten Passwörter sind 64 Zeichen lang |

Unten **Save** tippen (jeder Bereich hat seinen eigenen Knopf).

### 1.2 Authentication → Rate Limits

| Einstellung | Wert |
|---|---|
| Rate limit for **sign ups and sign ins** (je 5 Minuten, je Internetanschluss) | **150** |
| Rate limit for **token refreshes** (je 5 Minuten) | **300** |
| Rate limit for **anonymous users** (je Stunde) | **200** |
| Rate limit for token verifications / OTP | Standard lassen |
| E-Mail-Grenze | nicht anfassen (die App schickt keine E-Mails) |

> Viele Spieler im selben WLAN (Schule, Party) teilen sich diese Grenzen. Kommt in der Hall „Supabase bremst gerade“,
> waren es zu viele auf einmal: ein paar Minuten warten oder die Werte noch höher setzen.

### 1.3 Authentication → Attack Protection (bzw. Bot and Abuse Protection)

| Einstellung | Wert | Warum |
|---|---|---|
| **Captcha protection** | **aus** | Die App schickt kein Captcha mit; an = niemand kann sich mehr anmelden (`captcha_failed`) |
| Leaked password protection | aus (egal) | Die Passwörter sind abgeleitet, nicht von Menschen |

### 1.4 Authentication → Sessions (nur, wenn es den Punkt gibt)

| Einstellung | Wert | Warum |
|---|---|---|
| **Single session per user** | **aus** | Mehrere Geräte mit demselben Namen sind dasselbe Konto; an = die anderen fliegen raus |
| Time-box user sessions / Inactivity timeout | **aus / 0** | Sonst wird man ständig abgemeldet |

### 1.5 Project Settings → API Keys (Zugangsdaten)

- Die App und der Snake-Server benutzen den Wert aus der GitHub-Variable **`VITE_SUPABASE_ANON_KEY`**: entweder den alten
  **anon public** Key oder den neuen **Publishable key** (`sb_publishable_…`). Beide gehen.
- **Niemals „Disable legacy API keys“ tippen**, solange in GitHub noch der alte anon-Key steht: dann ist sofort alles offline.
  Wer umstellen will: erst den Publishable key in die GitHub-Variable eintragen, dann unter **Actions** die Läufe
  **Web-App**, **Android-APK** und **Snake-Server (Cloudflare)** neu starten (Run workflow), APK neu installieren, ein paar Tage
  warten (alte APKs haben den alten Key eingebaut), erst dann die alten Keys abschalten.
- Den **service_role**/**secret** Key nie irgendwo eintragen oder verschicken.

### 1.6 Project Settings → JWT Keys

- **Nichts rotieren oder widerrufen**, wenn es keinen Grund gibt. Ein neuer JWT-Schlüssel meldet alle Geräte ab. Die App meldet
  sich danach zwar über den Namen wieder an, alte Gast-Konten (ohne Namen-Konto) sind dann aber verloren.

### 1.7 Project Settings → Data API (bzw. API → Settings)

- **Exposed schemas**: `public` muss dabei sein (Standard).
- **Max rows**: mindestens **1000** (die Hall lädt bis zu 1000 Spieler).

### 1.8 Realtime → Settings (nur, wenn es den Punkt gibt)

- **Allow public access** (Channel restrictions): **an**. Die Lobby („wer ist online“, Einladungen) ist ein offener Kanal.
  Aus = niemand sieht mehr, wer online ist.
- Concurrent clients / Max events per second: Standard lassen (die App schickt höchstens 5 Ereignisse je Sekunde).

### 1.9 Database → Publications

- Unter **supabase_realtime** müssen diese Tabellen an sein: `score`, `sieg`, `koop_ergebnis`, `nachricht`, `freund_anfrage`,
  `freund`. **`profile` muss aus sein** (darin steht der private Freundes-Code). Der Selbsttest (Teil 2) prüft das.

### 1.10 Was du nicht brauchst

Custom SMTP, Redirect-URLs, Edge Functions, Storage, Vault, Webhooks, Point-in-Time-Recovery: alles nicht nötig.

---

## Teil 2: Datenbank vollständig machen und prüfen

1. **Datenbank auf Stand bringen:** `supabase/NACHHOLEN.sql` öffnen → **Copy raw file** → Supabase **SQL Editor → New query**
   → einfügen → **Run**. Erwartet: „Success. No rows returned“. Warnung „destructive operation“: **Run this query**.
   Die Datei enthält alles seit Version 1.27 und lässt sich beliebig oft ausführen.
2. **Selbsttest:** `supabase/SELBSTTEST.sql` genauso in eine **neue Query** kopieren und **Run**. Er ändert nichts.
3. **Ergebnis lesen:** Jede Zeile soll in der Spalte **stand** `ok` zeigen.
   - Steht irgendwo **FEHLT**: die Datei aus der Spalte **loesung** genauso ausführen (liegt in `supabase/migrations/`,
     NACHHOLEN.sql liegt direkt in `supabase/`). Bei mehreren: **der Reihe nach** (nach Datum im Dateinamen), danach noch einmal
     NACHHOLEN.sql, dann wieder den Selbsttest.
   - Unten stehen Zahlen: wie viele in der Hall stehen, wie viele Konten **keinen** Hall-Eintrag haben (meist alte Gäste,
     harmlos), wie groß die Datenbank ist.

> Alle SQL-Dateien sind gegen ein echtes PostgreSQL getestet: alle Migrationen der Reihe nach, NACHHOLEN.sql zweimal
> hintereinander, dann der Selbsttest mit „ok“ überall.

---

## Teil 3: Die wichtigsten Abfragen (SQL Editor, zum Kopieren)

**Alle Spieler mit Rekord und Code**
```sql
select p.name, p.skin, p.code, p.silber, p.updated_at,
       (select max(s.level) from public.score s where s.user_id = p.id) as rekord
from public.profile p order by p.updated_at desc;
```

**Unsichtbare Konten (angemeldet, aber nicht in der Hall)**
```sql
select u.id, u.is_anonymous, u.created_at, u.last_sign_in_at
from auth.users u left join public.profile p on p.id = u.id
where p.id is null order by u.last_sign_in_at desc nulls last;
```

**Einen Spieler löschen** (Namen anpassen, Anführungszeichen bleiben; Profil, Ergebnisse, Freunde, Chat sind dann weg)
```sql
delete from auth.users
where id in (select id from public.profile where lower(name) = lower('Jannko 57'));
```

**Alte Gäste ohne Hall-Eintrag aufräumen** (unsichtbar für alle, macht die Zahlen sauber)
```sql
delete from auth.users
where is_anonymous and id not in (select id from public.profile)
  and coalesce(last_sign_in_at, created_at) < now() - interval '14 days';
```

**Doppelte Namen mit Nummer finden** (z. B. „Jannko“ und „Jannko 57“)
```sql
select a.name, b.name as auch
from public.profile a join public.profile b
  on b.id <> a.id and lower(b.name) like lower(a.name) || ' %'
order by a.name;
```

**Wer hat zuletzt gespielt**
```sql
select p.name, s.level, s.tempo, s.created_at
from public.score s join public.profile p on p.id = s.user_id
order by s.created_at desc limit 30;
```

---

## Teil 4: Datenbank-Änderungen künftig automatisch (einmalig, 10 Minuten)

Danach kommt jede neue SQL-Datei beim Merge von selbst in die Datenbank, Teil 2 ist nie wieder nötig.

1. **Token:** Supabase rechts oben Profil → **Account Preferences** (bzw. Account) → **Access Tokens** → **Generate new token**,
   Name `github` → kopieren.
2. **Project Reference:** **Project Settings → General → Reference ID** (oder der Teil vor `.supabase.co` in der Projekt-URL).
3. **Datenbank-Passwort:** aus deinem Passwortmanager (Ersteinrichtung). Vergessen: **Project Settings → Database → Reset database
   password**, neues Passwort erzeugen und speichern (die App ist davon nicht betroffen).
4. GitHub → **Settings → Secrets and variables → Actions → Secrets → New repository secret**, drei Stück:

   | Name | Wert |
   |---|---|
   | `SUPABASE_ACCESS_TOKEN` | Token aus 1. |
   | `SUPABASE_PROJECT_REF` | Reference ID aus 2. |
   | `SUPABASE_DB_PASSWORD` | Passwort aus 3. |

5. **Wichtig, einmalig:** Weil bisher alles von Hand eingespielt wurde, kennt Supabase die Liste der erledigten Dateien nicht.
   Ohne diesen Schritt würde der erste automatische Lauf alles von vorn ausführen und an alten Ansichten scheitern.
   - Vorher Teil 2 machen (NACHHOLEN.sql, Selbsttest überall ok).
   - GitHub → **Actions** → links **Supabase-Datenbank** → **Run workflow** → Häkchen bei
     **„Einmalig: Alle bisherigen Dateien wurden schon von Hand eingespielt“** → **Run workflow**.
   - Grüner Haken = fertig. Ab jetzt laufen neue Dateien bei jedem Merge von selbst.
6. **Kontrolle beim nächsten Update:** Actions → Supabase-Datenbank: grüner Haken. Rot: auf den Lauf tippen, die Fehlermeldung
   lesen (oder mir schicken). Notfalls hilft immer: NACHHOLEN.sql von Hand.

---

## Teil 5: Fehler finden

### 5.1 In der App
- **Hall of Snakes:** roter Hinweis unter dem Namen = dieses Gerät ist nicht eingetragen. Die graue Zeile darunter ist der genaue
  Fehler (abfotografieren). **Neu verbinden** versucht es sofort.
- **Mehrspieler → Freunde:** Statt des Codes „------“ = nicht eingetragen, dort ebenfalls **Neu verbinden**.

### 5.2 Im Dashboard: Logs
- **Logs → Auth** (bzw. Logs Explorer → Auth): jede Anmeldung. Achte auf `429` (Grenzen aus 1.2 zu niedrig),
  `email_not_confirmed` (1.1 Confirm email ist an), `captcha_failed` (1.3), `reauthentication_needed` (1.1 Secure password change).
- **Logs → API / PostgREST**: Fehler beim Eintragen. `PGRST202` = Funktion fehlt (Teil 2), `42501` = keine Berechtigung
  (Teil 2, NACHHOLEN.sql), `23505` = Name vergeben (normal), `23503` = Profil fehlt (die App repariert das selbst).
- **Logs → Realtime**: Probleme mit Live-Liste und Lobby (1.8).

### 5.3 Advisors (Database → Advisors oder Advisors im Menü)
- **Security Advisor**: Warnungen zu „anonymous sign-ins“ und „leaked password protection“ sind hier **gewollt** (siehe 1.1/1.3).
  Echte Fehler wären „RLS disabled“ bei einer Snake-Tabelle: dann NACHHOLEN.sql bzw. die Datei aus dem Selbsttest ausführen.
- **Performance Advisor**: Hinweise zu Indizes kann man lassen, solange die Hall flott lädt.

### 5.4 Typische Probleme

| Beobachtung | Ursache | Lösung |
|---|---|---|
| Spieler fehlt, kein Freundes-Code | Profil nie angekommen | App neu öffnen, Hall → **Neu verbinden**; Teil 2 |
| „Supabase bremst gerade“ | Anmelde-Grenzen | 1.2, ein paar Minuten warten |
| Neuer Name geht auf keinem Gerät | Confirm email an | 1.1 |
| Umbenennen klappt nicht | Secure password/email change an | 1.1 |
| Niemand ist online zu sehen | Realtime-Kanal gesperrt | 1.8 |
| Alles offline, „Keine Verbindung“ | Projekt pausiert, Keys abgeschaltet | Teil 6, 1.5 |
| Löschen geht nicht | Funktion fehlt | Teil 2 |
| Skin/Rekord alt | alte App-Version | App neu öffnen / neue APK; ab 1.39 behoben |

---

## Teil 6: Gratis-Tarif: Grenzen und Pause

- Reicht für den Freundeskreis locker: ca. 500 MB Datenbank (Snake braucht wenige MB), 50.000 aktive Nutzer im Monat,
  ca. 200 gleichzeitige Live-Verbindungen. Der Selbsttest zeigt die Größe.
- **Pause nach etwa 7 Tagen ohne Aktivität:** Dann ist alles offline. Im Dashboard **Restore project** tippen (dauert ein paar
  Minuten, nichts geht verloren). Abhilfe auf Dauer: Teil 7, Punkt 1 (Wachhalten).
- **Keine automatischen Backups** im Gratis-Tarif. Abhilfe: Teil 7, Punkt 2.

---

## Teil 7: Was für das Online-Erlebnis sinnvoll ist (Vorschläge, nach Nutzen sortiert)

Nichts davon ist schon eingebaut. Sag Bescheid, was ich bauen soll.

| # | Was | Nutzen | Aufwand |
|---|---|---|---|
| 1 | **Wachhalten:** GitHub fragt täglich einmal die Hall ab | Projekt wird nie mehr pausiert | klein |
| 2 | **Wöchentliches Backup** per GitHub Action (Datenbank-Abzug als Datei) | Nichts geht verloren, Wiederherstellen möglich | klein |
| 3 | **Spielstand online:** Äpfel, Skins, Welten, Rekorde und Statistik im Profil | Neues Handy oder Neuinstallation: alles wieder da | groß |
| 4 | **„Konto sichern“:** E-Mail und Passwort oder Google/Apple an das bestehende Konto hängen (gleiche Nutzer-Id, Spielstand bleibt) | Echte Accounts, ohne dass jemand neu anfangen muss; Name allein bleibt möglich | mittel |
| 5 | **Name schützen:** Wer seinen Namen auf einem fremden Gerät eingibt, braucht einen 4-stelligen PIN (beim ersten Mal selbst gewählt) | Niemand kann sich als jemand anderes anmelden | mittel |
| 6 | **Verbindungs-Punkt im Startmenü:** grün = eingetragen, gelb = verbindet, rot = Fehler (antippen = Neu verbinden) | Man sieht sofort, ob man online zählt | klein |
| 7 | **Admin-Übersicht in der App:** unsichtbare Konten, doppelte Namen, letzte Fehler, Knopf „aufräumen“ | Kein SQL mehr nötig | mittel |
| 8 | **Push bei Chat und Freundschaftsanfragen** (nicht nur bei Einladungen) | Freunde merken es, auch wenn die App zu ist | mittel |
| 9 | **Wochen-Bestenliste** und kleine Saisons (z. B. je Welt) | Neue Spieler haben eine Chance, mehr Gründe zum Spielen | klein |
| 10 | **Schummelschutz für Rekorde** strenger (Runde mit Prüfsumme, Plausibilität je Welt) | Faire Hall of Snakes | mittel |

**Zu „echte Accounts“:** Empfehlung ist Punkt 3 + 4 zusammen (oder 3 + 5): Der Name bleibt der einfache Einstieg, wer will,
sichert sein Konto. Weil die Nutzer-Id dabei gleich bleibt, behalten alle Hall-Eintrag, Freunde, Chat und (mit Punkt 3) den
ganzen Spielstand. Ein harter Wechsel auf Pflicht-Accounts würde dagegen viele Spieler beim nächsten Start verlieren.
