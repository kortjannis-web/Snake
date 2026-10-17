# Plan: Freunde, Leaderboard und Mehrspieler

Stand: 17.10.2026, Version 1.13.0. Dieses Dokument beschreibt, wie aus Snake Endlos ein Spiel wird, das man
Freunden schickt (Android und iPhone), mit Gast-Namen, Online-Leaderboard (heute / für immer), Einladungen und
zwei Mehrspieler-Modi (**Gegeneinander** und **Füreinander**). Jede Phase ist für sich fertig und spielbar.

## 0. Was schon da ist

| Baustein | Stand |
|---|---|
| Web-App (PWA) | `.github/workflows/pages.yml` baut bei jedem Push auf den Hauptzweig nach GitHub Pages. Der Service Worker (`registerType: 'autoUpdate'`) holt die neue Fassung beim nächsten Start von selbst. |
| Android-APK | `.github/workflows/android.yml` baut bei jedem Push, auf dem Hauptzweig landet sie im Release `latest`. |
| Spiellogik ohne Darstellung | `src/game/` kennt kein Canvas und kein DOM. Sie läuft also auch auf einem Server oder im zweiten Gerät nur als Rechner. |
| Zufall mit Startwert | `rng(seed)` in `src/game/rng.ts`, `GameOpts.seed`: gleicher Startwert = gleiche Startwelt. |
| Tagesrekord lokal | `stats.heute` in `src/storage.ts`. |

**Damit gilt schon heute: Merge auf den Hauptzweig = neue Version für alle**, die die Web-App nutzen. Es fehlt nur
der Server-Teil.

## 1. Verteilung: ein Link für alle

**Empfehlung: die Web-App (PWA) ist der Weg für alle, die APK ist ein Extra für Android.**

- **iPhone:** Ohne App Store geht nur die PWA. Link in Safari öffnen → Teilen → „Zum Home-Bildschirm“. Dann läuft
  sie im Vollbild, offline, mit Speicher, der nicht nach 7 Tagen gelöscht wird (das passiert nur im normalen
  Safari-Tab), und mit Push-Benachrichtigungen (ab iOS 16.4, nur vom Home-Bildschirm aus).
  Eine echte iOS-App (TestFlight / App Store) braucht ein Apple-Developer-Konto (99 $/Jahr) und einen Mac oder
  einen Mac-Runner in GitHub Actions. Lohnt sich erst später.
- **Android:** Derselbe Link in Chrome → „App installieren“. Oder die APK aus dem Release.
- **Einmalig:** Settings → Pages → Source „GitHub Actions“ (steht schon im README). Danach ist die Adresse
  `https://kortjannis-web.github.io/Snake/`.

**Die APK aktualisiert sich nicht von selbst.** Zwei Wege:
1. Einfach: Die App fragt beim Start `version.json` von GitHub Pages ab (beim Build mit `__APP_VERSION__`
   erzeugen). Ist sie neuer, Hinweis „Neue Version“ mit Link auf `releases/latest`.
2. Komplett automatisch: In `capacitor.config.ts` `server: { url: 'https://kortjannis-web.github.io/Snake/' }`
   setzen. Dann lädt die APK immer die aktuelle Web-Fassung (offline hilft der Service Worker, der dafür dann auch
   in der App registriert werden muss: die Bedingung `!nativ` in `src/main.ts` entfällt).

**Mehrspieler braucht gleiche Versionen.** Jede Nachricht trägt `__APP_VERSION__` mit. Passt sie nicht, heißt es
„Bitte aktualisieren“ statt eines kaputten Spiels.

## 2. Server: Supabase (kostenlos für diesen Umfang)

Ein Anbieter für alles, ohne eigenen Server:

| Bedarf | Supabase-Teil |
|---|---|
| Gast ohne Passwort | **Anonymous Sign-In**: ergibt eine feste Nutzer-Id, die Sitzung liegt in `localStorage`. |
| Leaderboard | **Postgres** mit Row Level Security. |
| Wer ist online, Einladungen, Spiel in Echtzeit | **Realtime**: Presence (Online-Liste) und Broadcast (Nachrichten zwischen zwei Geräten). |
| Push-Benachrichtigung | **Edge Function**, die Web-Push (VAPID) verschickt. |

Alternative mit gleichem Aufbau: Firebase (Anonymous Auth, Firestore, Cloud Messaging). Supabase ist für
Leaderboard-Abfragen (SQL, „bester Level je Spieler heute“) bequemer.

Neue Datei `src/online.ts` kapselt alles. Das Spiel muss **ohne Netz unverändert laufen**: kein Netz = kein
Leaderboard, sonst nichts.

## 3. Phase 1: Name und Gast-Konto (½ Tag)

- Erster Start: Bildschirm „Wie heißt du?“ (2 bis 16 Zeichen). Neuer Schlüssel `snake.profil.v1` in
  `src/storage.ts`: `{ name, id, freundeCode }`.
- Name im Hauptmenü anzeigen, in den Optionen änderbar.
- `id` = Supabase-Nutzer-Id aus dem anonymen Login. `freundeCode` = 6 Zeichen daraus (z. B. `K7M2QX`), weil
  Namen nicht eindeutig sind.
- Fortschritt (Rekord, Äpfel, Skins) bleibt wie bisher lokal. Wer den Browser-Speicher löscht, ist ein neuer Gast.
  Später möglich: „Konto sichern“ per E-Mail-Link, Supabase kann ein anonymes Konto nachträglich verknüpfen.

## 4. Phase 2: Leaderboard (1 bis 2 Tage)

Tabellen (als Migration in `supabase/migrations/`):

```sql
create table profile (
  id uuid primary key references auth.users,
  name text not null check (char_length(name) between 2 and 16),
  code text unique not null,
  push jsonb,                          -- Web-Push-Abo (Phase 5)
  updated_at timestamptz default now()
);

create table score (
  id bigserial primary key,
  user_id uuid not null references profile(id),
  level int not null check (level between 1 and 5000),
  dauer_ms int not null,
  tempo text not null,
  version text not null,
  tag date not null default (now() at time zone 'Europe/Berlin')::date,
  created_at timestamptz default now()
);
create index on score (tag, level desc);
create index on score (level desc);

alter table profile enable row level security;
alter table score   enable row level security;
create policy "lesen" on profile for select using (true);
create policy "eigenes" on profile for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "lesen" on score for select using (true);
create policy "eintragen" on score for insert with check (auth.uid() = user_id);
```

Zwei Ansichten: **Heute** (`where tag = heute`, bester Level je Spieler) und **Für immer** (bester Level je
Spieler). Optional je Tempo getrennt.

**Nur echte Runden zählen.** Gemeldet wird beim Spielende (`die`-Ereignis) nur, wenn
- kein Kreativ-Modus und keine Sandbox (`istKreativ` in `src/main.ts`),
- kein `?level=`-Start (`startLevel === 1`) und kein `?auto=1`,
- die Master-Einstellungen auf Standard stehen (`config` gleich `DEFAULTS`), sonst könnte man sich die Regeln
  leicht machen.

Gegen grobes Schummeln: Plausibilität in der Datenbank (Level zu Dauer, z. B. höchstens 1 Level je 0,8 s). Mehr
lohnt sich unter Freunden nicht. Wer offline spielt, dessen Ergebnis wird gemerkt und später gesendet.

Im Spiel: neuer Menüpunkt **Bestenliste** mit zwei Reitern, der eigene Platz hervorgehoben.

## 5. Phase 3: Gegeneinander (3 bis 5 Tage)

Jeder spielt **seine eigene Welt**. Man sieht den anderen nur als **Schatten**, Hindernisse sind verschieden.
**Wer zuerst ein neues Gebiet erreicht, bestimmt, wo es hinkommt**, beim anderen kommt der Block genau dort hin,
ohne Wahl.

Warum das mit dem bestehenden Code gut geht:
- Beide starten mit demselben `seed`. Weil Mauern, Gegner usw. vom eigenen Weg abhängen (z. B. nie vor dem Kopf),
  laufen die Welten danach von selbst auseinander. Genau das ist gewollt.
- Die Kartenform bestimmen nur `blocks` und `expand()`. Bekommen beide dieselben Erweiterungen in derselben
  Reihenfolge, haben beide dieselbe Karte, und der Schatten passt an die richtige Stelle.

Was zu bauen ist:
1. **Feste Feldgröße:** `screenCells()` in `src/main.ts` hängt vom Gerät ab. Im Mehrspieler für beide gleich,
   z. B. 12 × 23, das Bild wird passend skaliert.
2. **Fremde Wahl in `Game`:** neue Methode `gebietVonAussen(level, block, dir)`.
   - Steht man selbst noch vor dem Level: merken, beim Erreichen in `welt()` statt der Wahl direkt
     `expand(ziel)`.
   - Läuft gerade die eigene Wahl (`this.wahl > 0`): Wahl abbrechen und `expand(ziel)`.
   - Koordinaten über `this.ursprung` in ein festes System umrechnen, weil `expand()` die Blöcke verschiebt,
     wenn links oder oben angebaut wird.
   - Auch der Zufallsblock nach „Zu spät“ wird gesendet, sonst hätten beide verschiedene Karten.
3. **Wer war zuerst:** Der Einladende ist Schiedsrichter. Der andere meldet seine Wahl, der Schiedsrichter
   bestätigt die erste je Level und schickt sie an beide. So gibt es nie zwei Gewinner bei gleichzeitigem
   Erreichen.
4. **Schatten:** ca. 10 × je Sekunde `{ body, dir, level, t }` per Broadcast. `src/render/renderer.ts` zeichnet
   die zweite Schlange mit ca. 30 % Deckkraft, ohne Kollision, weich interpoliert.
5. **Anzeige:** Level des anderen oben, Toast „Jannis hat das Gebiet gewählt“.
6. **Ende:** Vorschlag: Beide spielen, bis sie sterben. Der höhere Level gewinnt. Wer schon tot ist, schaut dem
   Schatten weiter zu.

## 6. Phase 4: Füreinander (1 bis 2 Wochen)

**Dieselbe Karte**, zwei echte Schlangen, man fährt durch den anderen hindurch (leicht durchsichtig, kein Geist).
Wer zuerst am Apfel ist, bekommt ihn.

Das ist der große Brocken, weil `Game` (ca. 2500 Zeilen) überall genau eine Schlange annimmt
(`this.body`, `this.dir`, Eingabepuffer, Power-up-Zeiten, Reaktionszeit `gnade`).

1. **Umbau `Game`:** Klasse `Schlange` mit allem, was je Spieler gilt (Körper, Richtung, Puffer, Wachsen,
   Schild/Geist/Zeitlupe, Gnade). `Game` bekommt `schlangen: Schlange[]`. Wichtige Stellen:
   - `gefahr()` und Kollision: die andere Schlange ist **kein** Hindernis.
   - `hindernisse()`, `imWeg()`, `aufSchlange()`, neue Mauern „nie vor dem Kopf“: für **beide** Köpfe prüfen.
   - Gegner-KI (`Sicht.dist`): Abstand zur jeweils näheren Schlange.
   - Level = gemeinsam gegessene Äpfel. Wachsen tut nur, wer isst.
   - Die vorhandenen Tests (`test/game.test.ts`) müssen mit einer Schlange unverändert grün bleiben.
2. **Netz: ein Gerät rechnet.** Der Einladende (Host) führt `Game` aus, der Gast schickt nur seine Wischer. Der
   Host sendet je Takt die Schlangen und die `drain()`-Ereignisse, alle 2 s den ganzen Zustand (damit
   verlorene Nachrichten nichts kaputt machen). Der Gast zeichnet nur.
   Verzögerung: Beim Gast reagiert die eigene Schlange um die Laufzeit später (meist 50 bis 150 ms, ein Takt
   ist 128 bis 185 ms). Für Freunde gut spielbar. Besser wird es, wenn der Gast seinen eigenen Kopf vorausberechnet.
   Später möglich: `src/game/` unverändert auf einem kleinen Node-Server laufen lassen, dann hat kein Gerät einen
   Vorteil.
3. **Offene Entscheidung:** Was passiert, wenn einer stirbt? Vorschlag: nach 3 s wieder einsetzen, kostet 5 Level
   (wie die Rückschläge). Vorbei, wenn beide gleichzeitig tot sind.

## 7. Phase 5: Einladungen und Benachrichtigungen (2 bis 3 Tage)

In dieser Reihenfolge, jede Stufe ist für sich nutzbar:

1. **Einladungs-Link (sofort, ohne Push):** „Freund einladen“ erzeugt `…/Snake/?spiel=AB12CD&modus=gegen`
   und öffnet das Teilen-Menü (WhatsApp usw., `navigator.share`). Wer den Link öffnet, ist im Spielraum.
2. **Im Spiel (wenn der andere die App offen hat):** Online-Liste über Realtime Presence, Freunde über
   den `freundeCode`. Einladen = Broadcast an den Kanal des anderen, bei ihm erscheint „Jannis fordert dich heraus
   (Gegeneinander)“ mit Annehmen / Ablehnen.
3. **Push (App geschlossen):** Web-Push mit VAPID-Schlüsseln. Beim ersten Einladen um Erlaubnis fragen, das Abo
   in `profile.push` speichern, eine Edge Function `einladen` verschickt die Nachricht. Funktioniert in Chrome
   (Android) und in der iPhone-PWA vom Home-Bildschirm. Der Service Worker braucht dafür einen `push`-Handler,
   also `vite-plugin-pwa` auf `injectManifest` umstellen.
   Die Capacitor-APK kann kein Web-Push. Dort entweder `@capacitor/push-notifications` mit Firebase, oder
   Weg 2 aus Abschnitt 1 (die APK lädt die Web-Fassung), dann reicht Weg 1 und 2 auch dort.

## 8. Automatisch ausliefern bei Push und Merge

Ziel: Merge auf den Hauptzweig → Web-App, APK **und** Datenbank sind aktuell.

1. **Supabase-Zugang als Secrets/Variablen** (Settings → Secrets and variables → Actions):
   - Variablen (öffentlich, landen in der App): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
     `VITE_VAPID_PUBLIC_KEY`. Der Anon-Key ist dafür gedacht, sichtbar zu sein, die Sicherheit kommt aus den
     Row-Level-Regeln.
   - Secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `VAPID_PRIVATE_KEY`.
2. In `pages.yml` und `android.yml` beim Schritt `npm run build` die Variablen als `env` setzen.
3. Neuer Workflow `supabase.yml` (nur Hauptzweig, nur wenn sich `supabase/**` ändert):
   ```yaml
   - uses: supabase/setup-cli@v1
   - run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
   - run: supabase db push
   - run: supabase functions deploy einladen
   ```
   Datenbank-Änderungen nur über neue Migrationsdateien, nie im Dashboard von Hand. So bleibt Git die Wahrheit.
4. **Reihenfolge beim Ausliefern:** Datenbank vor App. Neue Spalten immer so anlegen, dass die alte App weiter
   funktioniert (alte APKs und noch nicht aktualisierte PWAs sind eine Weile unterwegs).
5. **Zweige:** Arbeit auf Feature-Zweigen (bauen dort nur die APK als Artefakt), Merge auf den Hauptzweig liefert
   aus. Für Tests mit einem Freund vorher: ein zweites Supabase-Projekt als „Test“, die Feature-Zweige bauen
   gegen dieses.

## 9. Zeitplan

Mit Claude Code als Entwickler, gerechnet in Arbeitstagen inklusive Testen auf zwei Handys:

| Phase | Inhalt | Dauer | Danach können Freunde … |
|---|---|---|---|
| 0 | Pages an, Link verschicken, Update-Hinweis für die APK | ½ Tag | das Spiel auf jedem Handy spielen |
| 1 | Name, Gast-Konto | ½ Tag | mit Namen spielen |
| 2 | Leaderboard heute / für immer, CI für Supabase | 1–2 Tage | sich vergleichen |
| 3 | Gegeneinander mit Schatten und Gebiets-Wahl | 3–5 Tage | per Link gegeneinander spielen |
| 5 | Einladen in der App, Push | 2–3 Tage | sich herausfordern, auch wenn die App zu ist |
| 4 | Füreinander (Umbau auf zwei Schlangen) | 1–2 Wochen | zusammen auf einer Karte spielen |

**Leaderboard und Gegeneinander per Link: in gut einer Woche.** Füreinander zuletzt, weil es den größten Umbau
der Spiellogik braucht und Gegeneinander die ganze Netz-Grundlage (Räume, Versionen, Synchronisation) schon
liefert.

## 10. Vor dem Start zu entscheiden

1. Supabase oder Firebase? (Empfehlung: Supabase)
2. Gegeneinander: Gewinnt der höhere Level am Ende, oder wer zuerst ein bestimmtes Level erreicht?
3. Füreinander: Was passiert, wenn einer stirbt?
4. Mehrspieler-Tempo: fest „Normal“ oder wählt der Einladende?
5. Leaderboard je Tempo getrennt oder gemeinsam?
