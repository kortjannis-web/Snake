import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { gleich, spielstandZusammen, type Daten } from '../src/cloud'

/* Die echten Migrationen in einem echten Postgres (PGlite, laeuft im Testprozess). Supabase wird nachgebaut:
 * auth.users, auth.uid() (aus einer Einstellung), die Rollen anon/authenticated und die Realtime-Publication. */

const datei = (n: string) => readFileSync(new URL(`../supabase/migrations/${n}`, import.meta.url), 'utf8')
const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'

let db: PGlite

async function als(uid: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('test.uid', '${uid ?? ''}', false);`)
  if (uid) await db.exec('set role authenticated')
  try {
    return await db.query<Record<string, unknown>>(sql, params)
  } finally {
    await db.exec('reset role')
  }
}
const abgleich = async (uid: string, vorgang: string | null, basis: Daten | null, lokal: Daten | null) =>
  (await als(uid, 'select public.spielstand_abgleichen($1, $2, $3) as r', [vorgang, basis === null ? null : JSON.stringify(basis), lokal === null ? null : JSON.stringify(lokal)])).rows[0].r as { daten: Daten; stand: number; doppelt?: boolean }
const zeile = async (uid: string) => (await db.query<{ daten: Daten; stand: number }>('select daten, stand from public.spielstand where id = $1', [uid])).rows[0]

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant usage on schema public to anon, authenticated;
    create publication supabase_realtime;
    insert into auth.users values ('${A}'), ('${B}');
  `)
  for (const n of ['20261026000100_spielstand.sql', '20261106000000_kampagne.sql', '20261108000000_spielstand_server.sql']) await db.exec(datei(n))
  // Zweimal ausfuehren schadet nicht
  await db.exec(datei('20261108000000_spielstand_server.sql'))
}, 60_000)

describe('Datenbank: spielstand_abgleichen', () => {
  it('ohne Anmeldung: Fehler', async () => {
    await expect(als(null, `select public.spielstand_abgleichen(null, null, '{}')`)).rejects.toThrow(/Nicht angemeldet|permission/)
  })

  it('erster Abgleich legt an, zweites Geraet rechnet nur seine Aenderung dazu', async () => {
    const r1 = await abgleich(A, crypto.randomUUID(), null, { wallet: { aepfel: 100, skins: ['klassik'] }, stats: { games: 5, best: 30 } })
    expect(r1.daten.wallet).toEqual({ aepfel: 100, skins: ['klassik'] })
    expect(r1.stand).toBe(1)
    // Geraet 2 kannte Stand r1, hat 20 Aepfel verdient und einen Skin gekauft (10 ausgegeben)
    const r2 = await abgleich(A, crypto.randomUUID(), r1.daten, { wallet: { aepfel: 110, skins: ['klassik', 'gold'] }, stats: { games: 6, best: 25 } })
    // Geraet 1 hat offline weitergespielt: +50 Aepfel, Rekord 40
    const r3 = await abgleich(A, crypto.randomUUID(), r1.daten, { wallet: { aepfel: 150, skins: ['klassik'] }, stats: { games: 8, best: 40 } })
    expect(r2.stand).toBe(2)
    expect(r3.daten.wallet).toEqual({ aepfel: 160, skins: ['klassik', 'gold'] })
    expect(r3.daten.stats).toEqual({ games: 9, best: 40 })
  })

  it('dieselbe Anfrage zweimal (Antwort verloren): zaehlt nur einmal', async () => {
    const vor = await zeile(A)
    const id = crypto.randomUUID()
    const lokal = { ...vor.daten, wallet: { ...vor.daten.wallet, aepfel: Number(vor.daten.wallet!.aepfel) - 60 } }
    const x = await abgleich(A, id, vor.daten, lokal)
    const y = await abgleich(A, id, vor.daten, lokal)
    expect(x.daten.wallet!.aepfel).toBe(100)
    expect(y.doppelt).toBe(true)
    expect(y.daten.wallet!.aepfel).toBe(100)
    expect(y.stand).toBe(x.stand)
  })

  it('Kauf senkt den Vorrat, aber nie unter 0', async () => {
    const vor = await zeile(A)
    // Beide Geraete kaufen fuer 80, obwohl nur 100 da sind
    await abgleich(A, crypto.randomUUID(), vor.daten, { ...vor.daten, wallet: { ...vor.daten.wallet, aepfel: 20 } })
    const r = await abgleich(A, crypto.randomUUID(), vor.daten, { ...vor.daten, wallet: { ...vor.daten.wallet, aepfel: 20 } })
    expect(r.daten.wallet!.aepfel).toBe(0)
  })

  it('nichts Neues: kein Schreiben (kein Live-Signal im Kreis)', async () => {
    const vor = await zeile(A)
    const r = await abgleich(A, crypto.randomUUID(), vor.daten, vor.daten)
    expect(r.stand).toBe(vor.stand)
    const nurLesen = await abgleich(A, null, null, null)
    expect(nurLesen.stand).toBe(vor.stand)
  })

  it('angefangene Aepfel (wallet.rest) bleiben auf dem Geraet', async () => {
    const vor = await zeile(A)
    const r = await abgleich(A, crypto.randomUUID(), vor.daten, { ...vor.daten, wallet: { ...vor.daten.wallet, rest: 55 } })
    expect(r.daten.wallet).not.toHaveProperty('rest')
  })

  it('jeder sieht und aendert nur seinen eigenen Stand', async () => {
    await abgleich(B, crypto.randomUUID(), null, { wallet: { aepfel: 7 } })
    const sicht = await als(A, 'select id from public.spielstand')
    expect(sicht.rows.map((z) => z.id)).toEqual([A])
    expect((await zeile(B)).daten.wallet).toEqual({ aepfel: 7 })
    const vorgang = await als(A, 'select count(*) from public.spielstand_vorgang').catch((e: Error) => e)
    expect(vorgang).toBeInstanceOf(Error)
  })
})

describe('Datenbank: alte Apps schreiben direkt', () => {
  it('Listen und Bestwerte koennen nicht schrumpfen, unbekannte Felder bleiben', async () => {
    await abgleich(B, crypto.randomUUID(), null, { wallet: { aepfel: 50, skins: ['klassik', 'gold'] }, stats: { best: 80, games: 10, heute: { datum: '2026-11-07', best: 30 } }, konto: { fuehrer: '2' } })
    const alt = await zeile(B)
    // Alte App mit veraltetem Stand: weniger Skins, kleinerer Rekord, kein `konto`
    await als(B, 'update public.spielstand set daten = $1, stand = stand + 1 where id = $2', [
      JSON.stringify({ wallet: { aepfel: 45, skins: ['klassik'] }, stats: { best: 60, games: 11, heute: { datum: '2026-11-08', best: 5 } } }),
      B,
    ])
    const neu = await zeile(B)
    expect(neu.stand).toBe(alt.stand + 1)
    expect(neu.daten.wallet).toEqual({ aepfel: 45, skins: ['klassik', 'gold'] })
    expect(neu.daten.stats).toEqual({ best: 80, games: 11, heute: { datum: '2026-11-08', best: 5 } })
    expect(neu.daten.konto).toEqual({ fuehrer: '2' })
  })
})

describe('Datenbank und App rechnen gleich', () => {
  // Zufaellige Staende: die Datenbank (ss_spielstand) muss genau das Ergebnis der App (spielstandZusammen) liefern
  let saat = 42
  const zufall = () => ((saat = (saat * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
  const zahl = (n: number) => Math.floor(zufall() * n)
  const vielleicht = <T>(v: T): T | undefined => (zufall() < 0.2 ? undefined : v)
  const teil = (l: string[]) => l.filter(() => zufall() < 0.5)
  const ohneLeer = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
  const stand = (): Daten => ({
    wallet: ohneLeer({
      aepfel: vielleicht(zahl(500)),
      skins: vielleicht(teil(['klassik', 'gold', 'bordeaux', 'steingolem'])),
      skin: vielleicht(['klassik', 'gold', '~fa10'][zahl(3)]),
      look: vielleicht({ farben: teil(['rot', 'blau']), muster: zufall() < 0.5 ? null : 'streifen' }),
      welten: vielleicht(teil(['wiese', 'wueste', 'winter'])),
      verdient: vielleicht(zahl(900)),
      rest: vielleicht(zahl(99)),
    }),
    stats: ohneLeer({
      best: vielleicht(zahl(120)),
      games: vielleicht(zahl(300)),
      time: vielleicht(zahl(1e7)),
      heute: vielleicht({ datum: `2026-11-0${1 + zahl(3)}`, best: zahl(80) }),
      zaehler: vielleicht(ohneLeer({ gold: vielleicht(zahl(50)), dia: vielleicht(zahl(20)) })),
      erfolge: vielleicht(teil(['apfel_1', 'sieg_1', 'level_50'])),
      weltBest: vielleicht(ohneLeer({ wiese: vielleicht(zahl(100)), wueste: vielleicht(zahl(100)) })),
    }),
    konto: ohneLeer({ fuehrer: vielleicht(['1', '2'][zahl(2)]), weltchat: vielleicht(zahl(1000)) }),
  })

  it('300 zufaellige Faelle', async () => {
    for (let i = 0; i < 300; i++) {
      const b = zufall() < 0.3 ? null : stand()
      const l = stand()
      const c = zufall() < 0.1 ? {} : stand()
      const r = await db.query<{ r: Daten }>('select public.ss_spielstand($1, $2, $3) as r', [b === null ? null : JSON.stringify(b), JSON.stringify(l), JSON.stringify(c)])
      const app = spielstandZusammen(b, l, c)
      if (!gleich(r.rows[0].r, app)) expect({ fall: i, b, l, c, db: r.rows[0].r }).toEqual({ fall: i, b, l, c, db: app })
    }
  })
})
