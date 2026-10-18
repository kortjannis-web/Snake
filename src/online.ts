/**
 * Online-Bestenliste ueber Supabase. Alles ist optional: ohne Zugangsdaten beim Bauen
 * (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) oder ohne Netz laeuft das Spiel unveraendert.
 * Der Supabase-Client wird erst bei Bedarf nachgeladen.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tempo } from './game/rules'

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const onlineAktiv = !!(URL && KEY)

export type Art = 'heute' | 'immer'
export type Zeile = { user_id: string; name: string; level: number; tempo: Tempo }
export type Ergebnis = { level: number; dauer: number; tempo: Tempo }

const PKEY = 'snake.profil.v1'
const QKEY = 'snake.online.queue.v1'
const MAX_WARTEND = 20

function lies<T>(k: string, def: T): T {
  try {
    const raw = localStorage.getItem(k)
    return raw ? (JSON.parse(raw) as T) : def
  } catch {
    return def
  }
}
function schreib(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* Speicher blockiert: egal */
  }
}

export const profil: { name: string } = { name: '', ...lies<{ name?: string }>(PKEY, {}) }
const warteschlange: Ergebnis[] = lies<Ergebnis[]>(QKEY, [])

export const nameGueltig = (n: string) => n.trim().length >= 2 && n.trim().length <= 16

let clientP: Promise<SupabaseClient> | null = null
function client(): Promise<SupabaseClient> {
  clientP ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true }, realtime: { params: { eventsPerSecond: 5 } } }),
  )
  return clientP
}

/** Gast-Anmeldung: beim ersten Mal wird eine Nutzer-Id angelegt, danach bleibt sie im Geraet */
async function nutzerId(): Promise<string> {
  const sb = await client()
  const { data } = await sb.auth.getSession()
  if (data.session) return data.session.user.id
  const { data: neu, error } = await sb.auth.signInAnonymously()
  if (error || !neu.user) throw error ?? new Error('Anmeldung fehlgeschlagen')
  return neu.user.id
}

/** Name speichern (Profil in der Datenbank anlegen oder aendern). Wirft bei Fehlern */
export async function setzeName(name: string) {
  const n = name.trim()
  if (!nameGueltig(n)) throw new Error('Der Name braucht 2 bis 16 Zeichen.')
  const sb = await client()
  const id = await nutzerId()
  const { error } = await sb.from('profile').upsert({ id, name: n, updated_at: new Date().toISOString() })
  if (error) throw error
  profil.name = n
  schreib(PKEY, { name: n })
  void sende()
}

let sendet = false
/** Wartende Ergebnisse senden. Ohne Netz bleiben sie liegen und kommen beim naechsten Mal dran */
export async function sende() {
  if (!onlineAktiv || !profil.name || sendet || !warteschlange.length) return
  sendet = true
  try {
    const sb = await client()
    const id = await nutzerId()
    while (warteschlange.length) {
      const e = warteschlange[0]
      const { error } = await sb.from('score').insert({ user_id: id, level: e.level, dauer_ms: e.dauer, tempo: e.tempo, version: __APP_VERSION__ })
      // Dauerhaft abgelehnt (Regel verletzt): wegwerfen. Netzfehler und Anmeldung: spaeter nochmal
      if (error && error.code !== '23514' && error.code !== 'P0001') break
      warteschlange.shift()
      schreib(QKEY, warteschlange)
    }
  } catch {
    /* kein Netz */
  } finally {
    sendet = false
  }
}

/** Ergebnis einer echten Runde melden (kommt in die Warteschlange und wird gesendet) */
export function melde(e: Ergebnis) {
  if (!onlineAktiv) return
  warteschlange.push(e)
  while (warteschlange.length > MAX_WARTEND) warteschlange.shift()
  schreib(QKEY, warteschlange)
  void sende()
}

/** Bestenliste laden (Top 50) und die eigene Nutzer-Id, falls angemeldet */
export async function ladeListe(art: Art): Promise<{ zeilen: Zeile[]; ich: string | null }> {
  const sb = await client()
  const { data, error } = await sb
    .from(art === 'heute' ? 'bestenliste_heute' : 'bestenliste_immer')
    .select('user_id,name,level,tempo')
    .order('level', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(50)
  if (error) throw error
  const { data: s } = await sb.auth.getSession()
  return { zeilen: (data ?? []) as Zeile[], ich: s.session?.user.id ?? null }
}

/** Live: ruft `bei` auf, sobald irgendwo ein neues Ergebnis eingetragen wird. Gibt die Abmeldung zurueck */
export function abonniere(bei: () => void): () => void {
  let weg = false
  let kanal: ReturnType<SupabaseClient['channel']> | null = null
  let sb: SupabaseClient | null = null
  let timer = 0
  void client().then((c) => {
    if (weg) return
    sb = c
    kanal = c
      .channel('bestenliste')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'score' }, () => {
        clearTimeout(timer)
        timer = window.setTimeout(bei, 400)
      })
      .subscribe()
  })
  return () => {
    weg = true
    clearTimeout(timer)
    if (kanal && sb) void sb.removeChannel(kanal)
  }
}

// Beim Start und wenn das Netz zurueckkommt: liegengebliebene Ergebnisse senden
if (onlineAktiv) {
  void sende()
  window.addEventListener('online', () => void sende())
}
