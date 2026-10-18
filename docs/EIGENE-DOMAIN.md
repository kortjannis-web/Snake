# Eigene Domain (z. B. `snake.deinname.de`)

Statt `https://kortjannis-web.github.io/Snake/` kann Snake unter einer eigenen Adresse laufen. Die App ist dafür
vorbereitet: Es braucht eine gekaufte Domain, zwei Einträge und eine Variable. Kosten: nur die Domain
(ca. 5 bis 15 € im Jahr, je nach Endung und Anbieter). GitHub Pages und HTTPS bleiben kostenlos.

## Vorher wissen: Wechsel möglichst früh

Eine neue Adresse ist für Browser eine **neue App**. Wer Snake schon über die alte Adresse auf dem Home-Bildschirm hat:

- Die alte Adresse leitet automatisch auf die neue weiter. Die alte App öffnet sich also weiter, aber mit leerem Speicher.
- Name, Rekord, Statistik, Äpfel und Geist hängen an der alten Adresse und kommen nicht mit. Der Name ist online
  schon vergeben, deshalb muss man einen neuen wählen (z. B. „Max 2“). Die Online-Bestenliste bleibt erhalten.
- Am besten: Snake einmal von der neuen Adresse zum Home-Bildschirm hinzufügen und die alte App löschen.

Die Android-APK ist nicht betroffen (sie hat ihren Speicher im Gerät) und findet Updates nach dem nächsten Build über die neue Adresse.

## Schritt 1: Domain kaufen

Bei einem Anbieter deiner Wahl, z. B. **Cloudflare Registrar** (du hast dort schon ein Konto: links **Domain Registration**
→ **Register Domains**, verkauft zum Einkaufspreis, aber nicht jede Endung, `.de` z. B. bisher nicht), INWX, Namecheap, Strato oder IONOS.

Tipp: eine **Subdomain** nutzen, z. B. `snake.deinname.de`. Dann bleibt `deinname.de` frei für anderes, und es ist nur ein Eintrag nötig.

## Schritt 2: DNS-Eintrag setzen

Beim Anbieter der Domain unter **DNS** einen Eintrag anlegen:

| Typ | Name | Ziel |
|---|---|---|
| `CNAME` | `snake` | `kortjannis-web.github.io` |

Bei Cloudflare: beim Eintrag die **orange Wolke ausschalten** („DNS only“, grau). Sonst bekommt GitHub kein HTTPS-Zertifikat.

Soll Snake direkt unter `deinname.de` laufen (ohne `snake.`), stattdessen vier `A`-Einträge mit Namen `@` und den Zielen
`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.

## Schritt 3: In GitHub eintragen

1. Repo → **Settings** → **Pages** → **Custom domain**: `snake.deinname.de` eintragen → **Save**.
2. Warten, bis „DNS check successful“ erscheint (wenige Minuten, selten bis zu einem Tag).
3. **Enforce HTTPS** anhaken (geht erst, wenn das Zertifikat fertig ist, ca. 15 Minuten).
4. Empfohlen gegen Missbrauch: GitHub → dein Profilbild → **Settings** → **Pages** → **Add a domain** und die Domain
   bestätigen (GitHub zeigt einen `TXT`-Eintrag, den du wie in Schritt 2 anlegst).

Eine `CNAME`-Datei im Repo ist nicht nötig, weil die Seite über GitHub Actions veröffentlicht wird.

## Schritt 4: Die App auf die neue Adresse umstellen

1. **Settings** → **Secrets and variables** → **Actions** → Reiter **Variables** → **New repository variable**:

   | Name | Wert |
   |---|---|
   | `VITE_PAGES_URL` | `https://snake.deinname.de/` (mit `/` am Ende) |

2. **Actions** → **Web-App (GitHub Pages)** → **Run workflow**, danach **Android-APK** → **Run workflow**.

Damit zeigen Update-Hinweis der Android-App, Einladungs-Links und „Link kopieren“ auf die neue Adresse.
Snake-Server und Supabase brauchen keine Änderung.

## Kontrolle

- `https://snake.deinname.de/` öffnen: Snake erscheint (am Handy die Installationsanleitung).
- `https://snake.deinname.de/version.json` zeigt die aktuelle Version.
- `https://kortjannis-web.github.io/Snake/` leitet auf die neue Adresse weiter.
