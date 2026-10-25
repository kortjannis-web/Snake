import { beforeEach, describe, expect, it, vi } from 'vitest'
import { kontoZugang, passwortZugang } from '../src/konto'

/* Kleines Fake-Supabase: Nutzer mit E-Mail/Passwort, Gaeste, Tabelle "profile" mit eindeutigem Namen */
type Nutzer = { id: string; email?: string; password?: string; is_anonymous: boolean; unbestaetigt?: boolean; meta?: Record<string, unknown> }
const db = { nutzer: [] as Nutzer[], profile: [] as { id: string; name: string; skin?: string; silber?: number }[], score: [] as { user_id: string; level: number }[], scoreSperre: 0, n: 0, bestaetigung: false, sitzungVon: '', alteSitzung: null as Nutzer | null }

function neuerClient() {
  // alteSitzung: im Geraet gespeichert, den Nutzer gibt es auf dem Server vielleicht nicht mehr
  let sitzung: Nutzer | null = db.nutzer.find((x) => x.id === db.sitzungVon) ?? db.alteSitzung ?? null
  const fehler = (code: string, message = code) => ({ code, message })
  const alsUser = (u: Nutzer) => ({ id: u.id, email: u.email, is_anonymous: u.is_anonymous, user_metadata: { ...u.meta } })
  const auth = {
    getSession: async () => ({ data: { session: sitzung ? { user: alsUser(sitzung) } : null } }),
    getUser: async () =>
      sitzung && db.nutzer.includes(sitzung) ? { data: { user: alsUser(sitzung) }, error: null } : { data: { user: null }, error: { ...fehler('user_not_found'), status: 403 } },
    signOut: async () => {
      sitzung = null
      return { error: null }
    },
    signInAnonymously: async () => {
      const u = { id: `u${++db.n}`, is_anonymous: true }
      db.nutzer.push(u)
      sitzung = u
      return { data: { user: alsUser(u) }, error: null }
    },
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      const u = db.nutzer.find((x) => x.email === email && x.password === password)
      if (!u) return { data: { user: null }, error: fehler('invalid_credentials') }
      if (u.unbestaetigt) return { data: { user: null }, error: fehler('email_not_confirmed') }
      sitzung = u
      return { data: { user: alsUser(u) }, error: null }
    },
    signUp: async ({ email, password, options }: { email: string; password: string; options?: { data?: Record<string, unknown> } }) => {
      if (db.nutzer.some((x) => x.email === email)) return { data: {}, error: fehler('user_already_exists') }
      const u: Nutzer = { id: `u${++db.n}`, email, password, is_anonymous: false, unbestaetigt: db.bestaetigung, meta: options?.data }
      db.nutzer.push(u)
      if (db.bestaetigung) return { data: { user: alsUser(u), session: null }, error: null }
      sitzung = u
      return { data: { user: alsUser(u), session: {} }, error: null }
    },
    updateUser: async ({ email, password, data }: { email?: string; password?: string; data?: Record<string, unknown> }) => {
      if (!sitzung) return { data: {}, error: fehler('session_not_found') }
      if (email && db.nutzer.some((x) => x.email === email && x !== sitzung)) return { data: {}, error: fehler('email_exists') }
      // Mit Bestaetigungs-Pflicht bleibt eine neue Adresse "wartend"
      if (email && !db.bestaetigung) Object.assign(sitzung, { email, is_anonymous: false })
      if (password) sitzung.password = password
      if (data) sitzung.meta = { ...sitzung.meta, ...data }
      return { data: { user: alsUser(sitzung) }, error: null }
    },
  }
  const tabelle = () => {
    let filter: (r: (typeof db.profile)[number]) => boolean = () => true
    let aktion: 'select' | 'update' = 'select'
    let werte: Record<string, unknown> = {}
    const ausfuehren = () => {
      const treffer = db.profile.filter(filter)
      if (aktion === 'update') {
        if (werte.name && db.profile.some((p) => p.name.toLowerCase() === String(werte.name).toLowerCase() && !treffer.includes(p))) return { data: null, error: fehler('23505') }
        treffer.forEach((t) => Object.assign(t, werte))
        return { data: null, error: null }
      }
      return { data: treffer, error: null }
    }
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (k: string, v: unknown) => ((filter = (r) => (r as Record<string, unknown>)[k] === v), q),
      ilike: (k: string, v: string) => ((filter = (r) => ((r as Record<string, unknown>)[k] as string).toLowerCase() === v.toLowerCase()), q),
      limit: () => q,
      maybeSingle: async () => ({ data: ausfuehren().data?.[0] ?? null, error: null }),
      update: (w: Record<string, unknown>) => ((aktion = 'update'), (werte = w), q),
      // Ergebnisse (Tabelle score): Fremdschluessel aufs Profil, "zu schnell hintereinander" wie der Trigger
      insert: async (z: { user_id: string; level: number }) => {
        if (!db.profile.some((p) => p.id === z.user_id)) return { error: fehler('23503') }
        if (db.scoreSperre > 0) {
          db.scoreSperre--
          return { error: fehler('P0001', 'zu schnell hintereinander') }
        }
        db.score.push({ user_id: z.user_id, level: z.level })
        return { error: null }
      },
      upsert: async (d: { id: string; name: string }) => {
        const vorhanden = db.profile.find((p) => p.id === d.id)
        if (db.profile.some((p) => p.id !== d.id && p.name.toLowerCase() === d.name.toLowerCase())) return { error: fehler('23505') }
        if (vorhanden) Object.assign(vorhanden, d)
        else db.profile.push({ ...d })
        return { error: null }
      },
      then: (ok: (v: unknown) => unknown) => Promise.resolve(ausfuehren()).then(ok),
    }
    return q
  }
  // profil_speichern wie in der Datenbank (20261025000000_profil_reparatur.sql), sonst: Funktion fehlt
  const rpc = async (fn: string, a: Record<string, unknown>) => {
    if (fn !== 'profil_speichern') return { data: null, error: fehler('PGRST202') }
    if (!sitzung) return { data: null, error: fehler('P0001', 'Nicht angemeldet.') }
    if (!db.nutzer.includes(sitzung)) return { data: null, error: fehler('P0002', 'Konto gibt es nicht mehr.') }
    const name = String(a.p_name)
    if (db.profile.some((p) => p.id !== sitzung!.id && p.name.toLowerCase() === name.toLowerCase())) return { data: null, error: fehler('23505') }
    const d = { id: sitzung.id, name, ...(a.p_skin ? { skin: String(a.p_skin) } : {}), ...(a.p_silber ? { silber: Number(a.p_silber) } : {}) }
    const vorhanden = db.profile.find((p) => p.id === d.id)
    if (vorhanden) Object.assign(vorhanden, d)
    else db.profile.push(d)
    return { data: `C${d.id}`, error: null }
  }
  return { auth, from: tabelle, channel: vi.fn(), removeChannel: vi.fn(), rpc }
}

vi.mock('@supabase/supabase-js', () => ({ createClient: () => neuerClient() }))

/** Frisches "Geraet": eigener Speicher, eigene Sitzung (neues Modul), gemeinsame Datenbank */
async function geraet(profil?: Record<string, unknown>) {
  const speicher = new Map<string, string>()
  if (profil) speicher.set('snake.profil.v1', JSON.stringify(profil))
  vi.stubGlobal('localStorage', { getItem: (k: string) => speicher.get(k) ?? null, setItem: (k: string, v: string) => void speicher.set(k, v) })
  vi.stubGlobal('window', { addEventListener: () => undefined, setTimeout, clearTimeout })
  vi.stubGlobal('__APP_VERSION__', 'test')
  vi.stubEnv('VITE_SUPABASE_URL', 'http://fake')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'key')
  vi.resetModules()
  const m = await import('../src/online')
  await new Promise((r) => setTimeout(r, 20))
  return m
}

/** Konto von vor 1.42: Passwort aus dem Namen abgeleitet, ohne pw-Merker */
function altesKonto(id: string, name: string) {
  const u: Nutzer = { id, ...kontoZugang(name), is_anonymous: false }
  db.nutzer.push(u)
  db.profile.push({ id, name })
  return u
}

beforeEach(() => {
  db.nutzer = []
  db.profile = []
  db.score = []
  db.scoreSperre = 0
  db.n = 0
  db.bestaetigung = false
  db.sitzungVon = ''
  db.alteSitzung = null
})

describe('Anmeldung mit Name und Passwort (online)', () => {
  it('neuer Name legt den Account an und steht in der Hall, auf dem zweiten Geraet ist es derselbe', async () => {
    const a = await geraet()
    expect(a.angemeldet()).toBe(false)
    expect(await a.anmelden('Jannis', 'geheim')).toBe('neu')
    expect(a.angemeldet()).toBe(true)
    expect(db.profile).toEqual([expect.objectContaining({ name: 'Jannis' })])
    const id = db.profile[0].id
    const b = await geraet()
    expect(await b.anmelden('jannis', 'geheim')).toBe('zurueck')
    expect(b.profil.name).toBe('Jannis') // Schreibweise aus dem Account
    expect(db.profile).toHaveLength(1)
    expect(await b.eigeneUid()).toBe(id)
  })

  it('falsches Passwort: abgelehnt, kein neuer Account, das Geraet bleibt abgemeldet', async () => {
    const a = await geraet()
    await a.anmelden('Jannis', 'geheim')
    const b = await geraet()
    await expect(b.anmelden('Jannis', 'falsch')).rejects.toBeInstanceOf(b.PasswortFalsch)
    expect(b.angemeldet()).toBe(false)
    expect(db.nutzer).toHaveLength(1)
    expect(await b.eigeneUid()).toBeNull()
  })

  it('Account von vor 1.42 (nur Name): das erste Passwort sichert ihn, danach gilt nur noch dieses', async () => {
    altesKonto('alt', 'Zoe')
    const a = await geraet({ name: 'Zoe' })
    expect(a.angemeldet()).toBe(false) // muss erst ein Passwort festlegen
    expect(await a.anmelden('Zoe', 'blume')).toBe('gesichert')
    expect(await a.eigeneUid()).toBe('alt')
    expect(db.nutzer[0].password).toBe(passwortZugang('Zoe', 'blume').password)
    const b = await geraet()
    await expect(b.anmelden('Zoe', 'anders')).rejects.toBeInstanceOf(b.PasswortFalsch)
    expect(await b.anmelden('Zoe', 'blume')).toBe('zurueck')
  })

  it('Geraet ist noch im alten Account angemeldet: das gewaehlte Passwort wird festgelegt', async () => {
    const u = altesKonto('alt', 'Mo')
    db.sitzungVon = u.id
    const a = await geraet({ name: 'Mo' })
    expect(await a.anmelden('Mo', 'mopw')).toBe('gesichert')
    expect(u.meta?.pw).toBe(1)
    expect(u.password).toBe(passwortZugang('Mo', 'mopw').password)
  })

  it('alter Gast mit Profil auf diesem Geraet wird zum Account mit Passwort (Id und Hall-Eintrag bleiben)', async () => {
    db.nutzer.push({ id: 'gast', is_anonymous: true })
    db.profile.push({ id: 'gast', name: 'Opa' })
    // auf einem fremden Geraet ist der Name belegt
    const fremd = await geraet()
    await expect(fremd.anmelden('Opa', 'opa1')).rejects.toBeInstanceOf(fremd.PasswortFalsch)
    db.sitzungVon = 'gast'
    const a = await geraet({ name: 'Opa' })
    expect(await a.anmelden('Opa', 'opa1')).toBe('gesichert')
    expect(db.nutzer.find((n) => n.id === 'gast')).toMatchObject({ is_anonymous: false, email: kontoZugang('Opa').email })
    db.sitzungVon = ''
    const b = await geraet()
    expect(await b.anmelden('opa', 'opa1')).toBe('zurueck')
    expect(await b.eigeneUid()).toBe('gast')
  })

  it('ohne Anmeldung gibt es online nichts: kein Gast, keine Ergebnisse, kein Umbenennen', async () => {
    const a = await geraet({ name: 'Lea' })
    a.melde({ level: 30, dauer: 60_000, tempo: 'normal' })
    await a.sende()
    await expect(a.setzeName('Lena')).rejects.toBeInstanceOf(a.NamenFehler)
    expect(db.nutzer).toEqual([])
    expect(db.score).toEqual([])
  })

  it('Umbenennen: neuer Name mit demselben Passwort, der alte Name ist frei', async () => {
    const a = await geraet()
    await a.anmelden('Jannis', 'geheim')
    const id = db.profile[0].id
    expect(await a.setzeName('Jan')).toBe('umbenannt')
    expect(db.profile).toEqual([expect.objectContaining({ id, name: 'Jan' })])
    const b = await geraet()
    expect(await b.anmelden('Jan', 'geheim')).toBe('zurueck')
    expect(await b.eigeneUid()).toBe(id)
    const c = await geraet()
    expect(await c.anmelden('Jannis', 'neu1')).toBe('neu')
  })

  it('Umbenennen auf einen vergebenen Namen: Fehler, der eigene Name bleibt', async () => {
    const a = await geraet()
    await a.anmelden('Jannis', 'geheim')
    const b = await geraet()
    await b.anmelden('Janis', 'tipp')
    await expect(b.setzeName('Jannis')).rejects.toBeInstanceOf(b.NameVergeben)
    expect(b.profil.name).toBe('Janis')
    expect(db.profile.map((p) => p.name).sort()).toEqual(['Janis', 'Jannis'])
  })

  it('fehlt das Profil in der Datenbank, legt der Start es wieder an (der Spieler steht wieder in der Hall)', async () => {
    const a = await geraet()
    await a.anmelden('Zoe', 'zoe1')
    const nutzer = db.nutzer[0]
    db.profile = []
    db.alteSitzung = nutzer
    const b = await geraet({ name: 'Zoe', pw: true })
    await b.sende()
    expect(db.profile).toEqual([expect.objectContaining({ id: nutzer.id, name: 'Zoe' })])
  })

  it('vom Admin geloescht: der Start meldet ab statt heimlich neu anzulegen; neu anmelden gibt einen frischen Account', async () => {
    const a = await geraet()
    await a.anmelden('Zoe2', 'zoe2')
    const nutzer = db.nutzer[0]
    db.profile = []
    db.nutzer = []
    db.alteSitzung = nutzer
    const b = await geraet({ name: 'Zoe2', pw: true })
    expect(db.profile).toEqual([])
    expect(b.angemeldet()).toBe(false)
    expect(b.onlineZustand().anmelden).toBe(true)
    db.alteSitzung = null
    const c = await geraet({ name: 'Zoe2' })
    expect(await c.anmelden('Zoe2', 'zoe2')).toBe('neu')
  })

  it('Abmelden: danach nicht mehr angemeldet, der Name bleibt zum Vorausfuellen', async () => {
    const a = await geraet()
    await a.anmelden('Ida', 'ida1')
    await a.abmelden()
    expect(a.angemeldet()).toBe(false)
    expect(a.profil.name).toBe('Ida')
    expect(await a.eigeneUid()).toBeNull()
  })

  it('Supabase nicht fertig eingerichtet (Bestaetigung an): klare Meldung statt Gast', async () => {
    db.bestaetigung = true
    const a = await geraet()
    await expect(a.anmelden('Jannis', 'geheim')).rejects.toThrow(/nicht fertig eingerichtet/)
    expect(a.angemeldet()).toBe(false)
    expect(db.nutzer.some((n) => n.is_anonymous)).toBe(false)
  })

  it('neuer Skin waehrend eines laufenden Speicherns geht nicht verloren', async () => {
    const a = await geraet()
    await a.anmelden('Mila', 'mila')
    a.setzeSkin('rosa')
    a.setzeSkin('gold') // kommt, waehrend "rosa" noch gespeichert wird
    await a.sende()
    await new Promise((r) => setTimeout(r, 20))
    expect(db.profile[0].skin).toBe('gold')
    expect(a.profil.offen).toBe(false)
  })

  it('"zu schnell hintereinander": Ergebnisse werden nicht weggeworfen, das beste kommt zuerst', async () => {
    const a = await geraet()
    await a.anmelden('Mila', 'mila')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      db.scoreSperre = 1
      a.melde({ level: 12, dauer: 60_000, tempo: 'normal' })
      a.melde({ level: 81, dauer: 600_000, tempo: 'normal' })
      await vi.advanceTimersByTimeAsync(10)
      await vi.advanceTimersByTimeAsync(5000)
      await vi.advanceTimersByTimeAsync(5000)
      expect(db.score.map((x) => x.level).sort((x, y) => y - x)).toEqual([81, 12])
    } finally {
      vi.useRealTimers()
    }
  })

  it('"Neu verbinden": fehlt das Profil, steht der Spieler danach wieder in der Hall', async () => {
    const a = await geraet()
    await a.anmelden('HaJa', 'haja')
    db.profile = []
    const z = await a.kontoReparieren()
    expect(z.ok).toBe(true)
    expect(db.profile).toEqual([expect.objectContaining({ name: 'HaJa' })])
  })

  it('Name hat 2 bis 16 Zeichen und keine Schimpfwoerter, das Passwort mindestens 4 Zeichen', async () => {
    const a = await geraet()
    await expect(a.anmelden('A', 'geheim')).rejects.toBeInstanceOf(a.NamenFehler)
    await expect(a.anmelden('Arschloch', 'geheim')).rejects.toBeInstanceOf(a.NamenFehler)
    await expect(a.anmelden('Jannis', 'abc')).rejects.toBeInstanceOf(a.NamenFehler)
    expect(db.nutzer).toEqual([])
  })
})
