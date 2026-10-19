import { beforeEach, describe, expect, it, vi } from 'vitest'

/* Kleines Fake-Supabase: Nutzer mit E-Mail/Passwort, Gaeste, Tabelle "profile" mit eindeutigem Namen */
type Nutzer = { id: string; email?: string; password?: string; is_anonymous: boolean; unbestaetigt?: boolean }
const db = { nutzer: [] as Nutzer[], profile: [] as { id: string; name: string; skin?: string; silber?: number }[], n: 0, bestaetigung: false, sitzungVon: '' }

function neuerClient() {
  let sitzung: Nutzer | null = db.nutzer.find((x) => x.id === db.sitzungVon) ?? null
  const fehler = (code: string, message = code) => ({ code, message })
  const alsUser = (u: Nutzer) => ({ id: u.id, email: u.email, is_anonymous: u.is_anonymous })
  const auth = {
    getSession: async () => ({ data: { session: sitzung ? { user: alsUser(sitzung) } : null } }),
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
    signUp: async ({ email, password }: { email: string; password: string }) => {
      if (db.nutzer.some((x) => x.email === email)) return { data: {}, error: fehler('user_already_exists') }
      const u: Nutzer = { id: `u${++db.n}`, email, password, is_anonymous: false, unbestaetigt: db.bestaetigung }
      db.nutzer.push(u)
      if (db.bestaetigung) return { data: { user: alsUser(u), session: null }, error: null }
      sitzung = u
      return { data: { user: alsUser(u), session: {} }, error: null }
    },
    updateUser: async ({ email, password }: { email: string; password: string }) => {
      if (db.nutzer.some((x) => x.email === email && x !== sitzung)) return { data: {}, error: fehler('email_exists') }
      if (db.bestaetigung) return { data: { user: alsUser(sitzung!) }, error: null }
      Object.assign(sitzung!, { email, password, is_anonymous: false })
      return { data: { user: alsUser(sitzung!) }, error: null }
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
  return { auth, from: tabelle, channel: vi.fn(), removeChannel: vi.fn(), rpc: vi.fn() }
}

vi.mock('@supabase/supabase-js', () => ({ createClient: () => neuerClient() }))

/** Frisches "Geraet": eigener Speicher, eigene Sitzung (neues Modul), gemeinsame Datenbank */
async function geraet() {
  const speicher = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => speicher.get(k) ?? null, setItem: (k: string, v: string) => void speicher.set(k, v) })
  vi.stubGlobal('window', { addEventListener: () => undefined, setTimeout, clearTimeout })
  vi.stubGlobal('__APP_VERSION__', 'test')
  vi.stubEnv('VITE_SUPABASE_URL', 'http://fake')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'key')
  vi.resetModules()
  return import('../src/online')
}

beforeEach(() => {
  db.nutzer = []
  db.profile = []
  db.n = 0
  db.bestaetigung = false
  db.sitzungVon = ''
})

describe('Account aus dem Namen (online)', () => {
  it('neuer Name legt den Account an, auf dem zweiten Geraet ist es derselbe', async () => {
    const a = await geraet()
    expect(await a.setzeName('Jannis')).toBe('neu')
    expect(db.profile).toHaveLength(1)
    const id = db.profile[0].id
    const b = await geraet()
    expect(await b.setzeName('jannis')).toBe('zurueck')
    expect(b.profil.name).toBe('Jannis') // Schreibweise aus dem Account
    expect(db.profile).toHaveLength(1)
    expect(db.nutzer.filter((n) => n.id === id)).toHaveLength(1)
    expect(await eigeneId(b)).toBe(id)
  })

  it('anderer Name ist ein anderer Account', async () => {
    const a = await geraet()
    await a.setzeName('Jannis')
    const b = await geraet()
    expect(await b.setzeName('Lea')).toBe('neu')
    expect(db.profile.map((p) => p.name).sort()).toEqual(['Jannis', 'Lea'])
  })

  it('Umbenennen: neuer Name gilt fuer den Account, der alte nicht mehr', async () => {
    const a = await geraet()
    await a.setzeName('Jannis')
    const id = db.profile[0].id
    expect(await a.setzeName('Jan')).toBe('umbenannt')
    expect(db.profile).toHaveLength(1)
    expect(db.profile[0].name).toBe('Jan')
    const b = await geraet()
    expect(await b.setzeName('Jan')).toBe('zurueck')
    expect(await eigeneId(b)).toBe(id)
    const c = await geraet()
    expect(await c.setzeName('Jannis')).toBe('neu') // alter Name ist frei
  })

  it('Umbenennen auf einen vergebenen Namen: Fehler, auf Wunsch Wechsel in den anderen Account', async () => {
    const a = await geraet()
    await a.setzeName('Jannis')
    const b = await geraet()
    await b.setzeName('Janis') // Tippfehler
    await expect(b.setzeName('Jannis')).rejects.toBeInstanceOf(b.NameVergeben)
    expect(b.profil.name).toBe('Janis')
    expect(await b.setzeName('Jannis', true)).toBe('zurueck')
    expect(await eigeneId(b)).toBe(db.profile.find((p) => p.name === 'Jannis')!.id)
  })

  it('alter Gast-Account wird beim Start auf den Namen umgestellt, danach geht der Name ueberall', async () => {
    // alter Stand: anonymer Nutzer mit Profil, Name im Geraet
    db.nutzer.push({ id: 'alt', is_anonymous: true })
    db.profile.push({ id: 'alt', name: 'Opa' })
    // auf einem neuen Geraet ist der Name noch nicht frei
    const neu = await geraet()
    expect(await neu.setzeName('Opa').catch((e) => e)).toBeInstanceOf(neu.NameAlterGast)
    // der Start auf dem alten Geraet stellt den Gast um
    db.sitzungVon = 'alt'
    const alt = await geraet()
    localStorage.setItem('snake.profil.v1', JSON.stringify({ name: 'Opa' }))
    vi.resetModules()
    const alt2 = await import('../src/online')
    alt2.kontoSichern()
    await new Promise((r) => setTimeout(r, 20))
    expect(db.nutzer.find((n) => n.id === 'alt')?.email).toBeTruthy()
    expect(db.nutzer.find((n) => n.id === 'alt')?.is_anonymous).toBe(false)
    expect(db.profile).toHaveLength(1)
    db.sitzungVon = ''
    const b = await geraet()
    expect(await b.setzeName('opa')).toBe('zurueck')
    expect(await b.eigeneUid()).toBe('alt')
    void alt
  })

  it('ohne Einrichtung (Bestaetigung an) laeuft es wie bisher als Gast weiter', async () => {
    db.bestaetigung = true
    const a = await geraet()
    expect(await a.setzeName('Jannis')).toBe('neu')
    expect(db.profile).toHaveLength(1)
    expect(db.nutzer.some((n) => n.is_anonymous)).toBe(true)
  })

  it('Name hat 2 bis 16 Zeichen und keine Schimpfwoerter', async () => {
    const a = await geraet()
    await expect(a.setzeName('A')).rejects.toBeInstanceOf(a.NamenFehler)
    await expect(a.setzeName('Arschloch')).rejects.toBeInstanceOf(a.NamenFehler)
  })
})

async function eigeneId(m: { eigeneUid: () => Promise<string | null> }) {
  return m.eigeneUid()
}
