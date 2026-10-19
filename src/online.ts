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

export type Art = 'heute' | 'immer' | 'alle' | 'siege' | 'koop' | 'tages'
export type Zeile = { user_id: string; name: string; level: number; tempo: Tempo; skin?: string; dauer_ms?: number }
export type Ergebnis = { level: number; dauer: number; tempo: Tempo; tages?: boolean }

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

/** `offen`: der Name steht noch nicht in der Datenbank (z. B. beim ersten Start ohne Netz) */
export const profil: { name: string; offen?: boolean; skin?: string; silber?: number } = { name: '', ...lies<{ name?: string; offen?: boolean; skin?: string; silber?: number }>(PKEY, {}) }
const warteschlange: Ergebnis[] = lies<Ergebnis[]>(QKEY, [])

/** Wie in der Datenbank (name_pruefen): ohne Schimpfwoerter, auch mit Ziffern statt Buchstaben */
const VERBOTEN = /(arsch|fick|fotze|hure|nazi|hitler|wichser|schlampe|spast|missgeburt|neger|nigg|penis|vagina|porno|fuck|shit|bitch|cunt|whore|slut|hurensohn|kanake|schwuchtel)/
export function nameErlaubt(n: string) {
  const t = n.toLowerCase().replace(/[0134578@$]/g, (z) => ({ '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', $: 's' })[z] ?? z)
  return !VERBOTEN.test(t.replace(/[^a-zäöüß]/g, ''))
}
export const nameGueltig = (n: string) => n.trim().length >= 2 && n.trim().length <= 16 && nameErlaubt(n.trim())

/** Fehler beim Namen, den der Spieler loesen muss (vergeben oder nicht erlaubt) */
export class NamenFehler extends Error {}
const namensFehler = (e: { code?: string; message?: string } | null) =>
  !e ? null : e.code === '23505' ? new NamenFehler('Diesen Namen gibt es schon. Bitte nimm einen anderen.') : e.code === 'P0001' && /Name/.test(e.message ?? '') ? new NamenFehler('Dieser Name ist nicht erlaubt.') : null

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

/** Profil (Name) in die Datenbank schreiben. Wirft ohne Netz */
/** Fehler: Spalte gibt es (noch) nicht (die SQL-Datei fuer den Skin wurde noch nicht ausgefuehrt) */
const spalteFehlt = (e: { code?: string } | null) => !!e && (e.code === '42703' || e.code === 'PGRST204')

async function syncProfil() {
  const id = await nutzerId()
  const sb = await client()
  const daten = { id, name: profil.name, updated_at: new Date().toISOString(), ...(profil.skin ? { skin: profil.skin } : {}), ...(profil.silber ? { silber: Math.floor(profil.silber) } : {}) }
  let { error } = await sb.from('profile').upsert(daten)
  // Spalte fehlt (SQL-Datei noch nicht ausgefuehrt): erst ohne Silber, dann nur mit Namen
  if (spalteFehlt(error) && 'silber' in daten) {
    const { silber: _s, ...ohne } = daten
    ;({ error } = await sb.from('profile').upsert(ohne))
  }
  if (spalteFehlt(error)) ({ error } = await sb.from('profile').upsert({ id, name: profil.name, updated_at: daten.updated_at }))
  if (error) throw namensFehler(error) ?? error
  profil.offen = false
  schreib(PKEY, { name: profil.name, skin: profil.skin, silber: profil.silber })
}

/** Silber-Trophaeen (alle je verdienten Aepfel) ins Profil, damit die Hall danach sortieren kann */
export function setzeSilber(n: number) {
  if ((profil.silber ?? 0) === n) return
  profil.silber = n
  if (!onlineAktiv || !profil.name) return schreib(PKEY, { name: profil.name, skin: profil.skin, silber: n })
  profil.offen = true
  schreib(PKEY, { name: profil.name, offen: true, skin: profil.skin, silber: n })
  void sende()
}

/** Skin geaendert: im Profil nachtragen, damit die anderen ihn in der Spielerliste sehen */
export function setzeSkin(skin: string) {
  if (profil.skin === skin) return
  profil.skin = skin
  if (!onlineAktiv || !profil.name) return schreib(PKEY, { name: profil.name, skin })
  profil.offen = true
  schreib(PKEY, { name: profil.name, offen: true, skin })
  void sende()
}

/**
 * Name speichern. Er gilt sofort auf dem Geraet, auch ohne Netz; in die Datenbank kommt er,
 * sobald es geht. Gibt zurueck, ob das schon geklappt hat.
 */
export async function setzeName(name: string): Promise<boolean> {
  const n = name.trim()
  if (!nameErlaubt(n)) throw new NamenFehler('Dieser Name ist nicht erlaubt.')
  if (!nameGueltig(n)) throw new NamenFehler('Der Name braucht 2 bis 16 Zeichen.')
  const vorher = { ...profil }
  profil.name = n
  profil.offen = true
  schreib(PKEY, { name: n, offen: true, skin: profil.skin })
  try {
    await syncProfil()
    void sende()
    return true
  } catch (e) {
    // Vergeben oder nicht erlaubt: alten Namen behalten und Bescheid geben. Ohne Netz: spaeter
    if (e instanceof NamenFehler) {
      Object.assign(profil, vorher)
      schreib(PKEY, { name: profil.name, offen: profil.offen, skin: profil.skin })
      throw e
    }
    return false
  }
}

let sendet = false
/** Name und wartende Ergebnisse senden. Ohne Netz bleibt alles liegen und kommt beim naechsten Mal dran */
export async function sende() {
  if (!onlineAktiv || !profil.name || sendet || (!profil.offen && !warteschlange.length)) return
  sendet = true
  try {
    if (profil.offen) {
      try {
        await syncProfil()
      } catch (e) {
        if (!(e instanceof NamenFehler)) throw e
        profil.name = `${profil.name.slice(0, 12)} ${Math.floor(10 + Math.random() * 90)}`
        await syncProfil()
      }
    }
    const sb = await client()
    const id = await nutzerId()
    while (warteschlange.length) {
      const e = warteschlange[0]
      const zeile: Record<string, unknown> = { user_id: id, level: e.level, dauer_ms: e.dauer, tempo: e.tempo, version: __APP_VERSION__ }
      let { error } = await sb.from('score').insert(e.tages ? { ...zeile, tages: true } : zeile)
      // Tages-Spalte fehlt noch (SQL-Datei 5 nicht ausgefuehrt): als normales Ergebnis eintragen
      if (e.tages && spalteFehlt(error)) ({ error } = await sb.from('score').insert(zeile))
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

/** Bestenliste laden (Top 50, bei "alle" bis zu 500 Spieler) und die eigene Nutzer-Id, falls angemeldet */
export async function ladeListe(art: Art): Promise<{ zeilen: Zeile[]; ich: string | null }> {
  const sb = await client()
  if (art === 'koop') {
    const { data, error } = await sb.from('koop_ergebnis').select('id,spieler,level').order('level', { ascending: false }).order('created_at', { ascending: true }).limit(50)
    if (error) throw error
    return { zeilen: (data ?? []).map((k) => ({ user_id: `koop-${k.id}`, name: (k.spieler as string[]).join(' & '), level: k.level as number, tempo: 'normal' as Tempo })), ich: null }
  }
  const quelle = art === 'heute' ? 'bestenliste_heute' : art === 'immer' ? 'bestenliste_immer' : art === 'siege' ? 'sieger_liste' : art === 'tages' ? 'bestenliste_tages' : 'spieler_alle'
  // Tageslevel: gleich viele Aepfel, dann die schnellere Zeit zuerst
  const abfrage = (spalten: string) =>
    sb
      .from(quelle)
      .select(spalten)
      .order('level', { ascending: false })
      .order(art === 'alle' || art === 'siege' ? 'name' : art === 'tages' && spalten.includes('dauer_ms') ? 'dauer_ms' : 'created_at', { ascending: true })
      .limit(art === 'alle' ? 500 : 50)
  let { data, error } = await abfrage(art === 'siege' ? 'user_id,name,level,skin' : art === 'tages' ? 'user_id,name,level,tempo,skin,dauer_ms' : 'user_id,name,level,tempo,skin')
  if (art === 'tages' && spalteFehlt(error)) ({ data, error } = await abfrage('user_id,name,level,tempo,skin'))
  if (spalteFehlt(error)) ({ data, error } = await abfrage('user_id,name,level,tempo'))
  if (error) throw error
  const { data: s } = await sb.auth.getSession()
  return { zeilen: (data ?? []) as unknown as Zeile[], ich: s.session?.user.id ?? null }
}

/** Live: ruft `bei` auf, sobald irgendwo ein neues Ergebnis oder ein neuer Spieler eingetragen wird. Gibt die Abmeldung zurueck */
export function abonniere(bei: () => void): () => void {
  let weg = false
  let kanal: ReturnType<SupabaseClient['channel']> | null = null
  let sb: SupabaseClient | null = null
  let timer = 0
  const melden = () => {
    clearTimeout(timer)
    timer = window.setTimeout(bei, 400)
  }
  void client().then((c) => {
    if (weg) return
    sb = c
    kanal = c
      .channel('bestenliste')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'score' }, melden)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sieg' }, melden)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'koop_ergebnis' }, melden)
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

/* ================= Freunde, Siege, Koop ================= */

export type Freund = { user_id: string; name: string; skin: string; level: number }

/** Eigener Freundes-Code (nur man selbst sieht ihn) */
export async function meinCode(): Promise<string | null> {
  if (!onlineAktiv || !profil.name) return null
  try {
    await nutzerId()
    const sb = await client()
    const { data, error } = await sb.rpc('mein_code')
    if (error) return null
    return (data as string | null) ?? null
  } catch {
    return null
  }
}

/** Freund mit Code hinzufuegen. Gibt den Namen zurueck oder wirft mit einer verstaendlichen Meldung */
export async function freundHinzufuegen(code: string): Promise<string> {
  await nutzerId()
  const sb = await client()
  const { data, error } = await sb.rpc('freund_hinzufuegen', { freund_code: code.trim().toUpperCase() })
  if (error) throw new Error(/unbekannt/.test(error.message) ? 'Diesen Code gibt es nicht.' : /eigener/.test(error.message) ? 'Das ist dein eigener Code.' : 'Das hat nicht geklappt. Bist du online?')
  const z = (data as { id: string; name: string }[] | null)?.[0]
  return z?.name ?? ''
}

export async function freundEntfernen(id: string) {
  const sb = await client()
  await sb.rpc('freund_entfernen', { freund_id: id })
}

export async function meineFreunde(): Promise<Freund[]> {
  if (!onlineAktiv || !profil.name) return []
  try {
    await nutzerId()
    const sb = await client()
    const { data, error } = await sb.from('meine_freunde').select('user_id,name,skin,level').order('name')
    if (error) return []
    return (data ?? []) as Freund[]
  } catch {
    return []
  }
}

/* ================= Hall of Snakes, Freundschaftsanfragen, Sperren, Chat ================= */

export type HallZeile = { user_id: string; name: string; skin: string; rekord: number; trophaeen: number; silber?: number }
export type Anfrage = { richtung: 'ein' | 'aus'; user_id: string; name: string; skin: string }
export type Gesperrt = { user_id: string; name: string }
export type Nachricht = { id: number; von: string; an: string; text: string; gelesen: boolean; created_at: string }
export type ChatInfo = { user_id: string; zuletzt: string; ungelesen: number }

/** Meldungen aus der Datenbank (P0001) sind fuer Spieler gedacht, alles andere ist meist das Netz */
function fehlerText(e: { code?: string; message?: string } | null) {
  if (e?.code === 'P0001' && e.message) return e.message.replace('moeglich', 'möglich')
  return 'Das hat nicht geklappt. Bist du online?'
}

/** Alle Spieler mit Skin, Rekord und Trophaeen (bis zu 1000), dazu die eigene Nutzer-Id */
export async function ladeHall(): Promise<{ zeilen: HallZeile[]; ich: string | null }> {
  const sb = await client()
  const abfrage = (spalten: string) => sb.from('hall_of_snakes').select(spalten).order('rekord', { ascending: false }).order('trophaeen', { ascending: false }).order('name', { ascending: true }).limit(1000)
  let { data, error } = await abfrage('user_id,name,skin,rekord,trophaeen,silber')
  if (spalteFehlt(error)) ({ data, error } = await abfrage('user_id,name,skin,rekord,trophaeen'))
  if (error) throw error
  const { data: s } = await sb.auth.getSession()
  return { zeilen: (data ?? []) as unknown as HallZeile[], ich: s.session?.user.id ?? null }
}

/** Admin: Spieler loeschen (Profil mit allem Drumherum). Das Passwort prueft die Datenbank */
export async function adminLoeschen(code: string, ziel: string) {
  const sb = await client()
  const { error } = await sb.rpc('admin_spieler_loeschen', { code, ziel })
  if (error) throw new Error(fehlerText(error))
}

export async function meineAnfragen(): Promise<Anfrage[]> {
  if (!onlineAktiv || !profil.name) return []
  try {
    await nutzerId()
    const sb = await client()
    const { data, error } = await sb.from('meine_anfragen').select('richtung,user_id,name,skin').order('created_at', { ascending: false })
    return error ? [] : ((data ?? []) as Anfrage[])
  } catch {
    return []
  }
}

/** Anfrage schicken. 'freunde': der andere hatte schon gefragt, ihr seid jetzt Freunde */
export async function anfrageSenden(uid: string): Promise<'gesendet' | 'freunde'> {
  await nutzerId()
  const sb = await client()
  const { data, error } = await sb.rpc('anfrage_senden', { ziel: uid })
  if (error) throw new Error(fehlerText(error))
  return data === 'freunde' ? 'freunde' : 'gesendet'
}

async function rufe(fn: string, args: Record<string, string>) {
  await nutzerId()
  const sb = await client()
  const { error } = await sb.rpc(fn, args)
  if (error) throw new Error(fehlerText(error))
}
export const anfrageAnnehmen = (uid: string) => rufe('anfrage_annehmen', { von_id: uid })
/** Eingehende Anfrage ablehnen oder eigene zurueckziehen */
export const anfrageLoeschen = (uid: string) => rufe('anfrage_loeschen', { andere: uid })
export const sperren = (uid: string) => rufe('sperren', { ziel: uid })
export const entsperren = (uid: string) => rufe('entsperren', { ziel: uid })

export async function meineSperren(): Promise<Gesperrt[]> {
  if (!onlineAktiv || !profil.name) return []
  try {
    await nutzerId()
    const sb = await client()
    const { data, error } = await sb.from('meine_sperren').select('user_id,name').order('name')
    return error ? [] : ((data ?? []) as Gesperrt[])
  } catch {
    return []
  }
}

const NSPALTEN = 'id,von,an,text,gelesen,created_at'

/** Die letzten 200 Nachrichten mit einem Freund, aelteste zuerst */
export async function ladeNachrichten(partner: string): Promise<Nachricht[]> {
  const ich = await nutzerId()
  const sb = await client()
  const { data, error } = await sb
    .from('nachricht')
    .select(NSPALTEN)
    .or(`and(von.eq.${ich},an.eq.${partner}),and(von.eq.${partner},an.eq.${ich})`)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return ((data ?? []) as Nachricht[]).reverse()
}

export async function sendeNachricht(partner: string, text: string): Promise<Nachricht> {
  const ich = await nutzerId()
  const sb = await client()
  const { data, error } = await sb.from('nachricht').insert({ von: ich, an: partner, text: text.trim().slice(0, 500) }).select(NSPALTEN).single()
  if (error) throw new Error(error.code === '42501' ? 'Ihr seid keine Freunde mehr.' : fehlerText(error))
  return data as Nachricht
}

export async function chatGelesen(partner: string) {
  try {
    const sb = await client()
    await sb.rpc('chat_gelesen', { partner })
  } catch {
    /* kein Netz: beim naechsten Oeffnen */
  }
}

export async function meineChats(): Promise<ChatInfo[]> {
  if (!onlineAktiv || !profil.name) return []
  try {
    await nutzerId()
    const sb = await client()
    const { data, error } = await sb.from('meine_chats').select('user_id,zuletzt,ungelesen')
    return error ? [] : ((data ?? []) as ChatInfo[])
  } catch {
    return []
  }
}

/** Live: neue Nachricht an mich, neue Anfrage an mich, neue Freundschaft. Gibt die Abmeldung zurueck */
export function abonniereSozial(bei: { nachricht: (n: Nachricht) => void; anfrage: () => void; freund: () => void }): () => void {
  let weg = false
  let kanal: ReturnType<SupabaseClient['channel']> | null = null
  let sb: SupabaseClient | null = null
  void (async () => {
    try {
      const ich = await nutzerId()
      sb = await client()
      if (weg) return
      kanal = sb
        .channel(`sozial-${ich}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'nachricht', filter: `an=eq.${ich}` }, (p) => bei.nachricht(p.new as Nachricht))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'freund_anfrage', filter: `an=eq.${ich}` }, () => bei.anfrage())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'freund', filter: `von=eq.${ich}` }, () => bei.freund())
        .subscribe()
    } catch {
      /* kein Netz */
    }
  })()
  return () => {
    weg = true
    if (kanal && sb) void sb.removeChannel(kanal)
  }
}

/** Eigenen Sieg eintragen (fuer die Sieges-Bestenliste) */
export async function meldeSieg(modus: string, gegner: number) {
  if (!onlineAktiv || !profil.name) return
  try {
    const sb = await client()
    const id = await nutzerId()
    await sb.from('sieg').insert({ user_id: id, modus, gegner: Math.max(1, Math.min(3, gegner)) })
  } catch {
    /* kein Netz: egal */
  }
}

/** Koop-Ergebnis eintragen (macht das Geraet, das am Ende rechnet) */
export async function meldeKoop(spieler: string[], level: number, dauer: number) {
  if (!onlineAktiv || !profil.name || spieler.length < 2) return
  try {
    const sb = await client()
    const id = await nutzerId()
    await sb.from('koop_ergebnis').insert({ von: id, spieler: spieler.slice(0, 4), level: Math.max(1, Math.floor(level)), dauer_ms: Math.max(1, Math.round(dauer)) })
  } catch {
    /* kein Netz: egal */
  }
}

/** Push-Abo im eigenen Profil speichern (privat; nur Freunde koennen damit eine Einladung schicken) */
export async function pushSpeichern(abo: PushSubscriptionJSON | null): Promise<boolean> {
  if (!onlineAktiv || !profil.name) return false
  try {
    await nutzerId()
    const sb = await client()
    const { error } = await sb.rpc('push_setzen', { abo })
    return !error
  } catch {
    return false
  }
}

/** Zugangs-Token der Gast-Anmeldung (fuer den Snake-Server bei Push-Einladungen) */
export async function zugangsToken(): Promise<string | null> {
  if (!onlineAktiv) return null
  try {
    await nutzerId()
    const sb = await client()
    const { data } = await sb.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

/** Eigene Nutzer-Kennung (fuer Freunde und Einladungen) */
export async function eigeneUid(): Promise<string | null> {
  if (!onlineAktiv) return null
  try {
    return await nutzerId()
  } catch {
    return null
  }
}

/* ================= Wer ist online, Einladungen ================= */

export type OnlineSpieler = { geraet: string; uid: string | null; name: string; skin: string; imSpiel: boolean }
export type Einladung = { an: string; von: string; vonUid?: string | null; vonName: string; code: string; modus: string }
export type Antwort = { an: string; von: string; vonName: string; ja: boolean }

type LobbyRueckruf = {
  liste: (o: OnlineSpieler[]) => void
  einladung: (e: Einladung) => void
  antwort: (a: Antwort) => void
}

/**
 * Alle offenen Apps treffen sich in einem Realtime-Kanal: Presence zeigt, wer online ist,
 * Broadcast traegt Einladungen (an eine Geraete-Kennung) und Antworten.
 */
export function lobby(ich: () => Omit<OnlineSpieler, 'uid'>, bei: LobbyRueckruf) {
  let kanal: ReturnType<SupabaseClient['channel']> | null = null
  let uid: string | null = null
  let weg = false
  const melden = async () => {
    if (!kanal) return
    const i = ich()
    if (!i.name) return
    try {
      await kanal.track({ ...i, uid })
    } catch {
      /* noch nicht verbunden */
    }
  }
  const start = async () => {
    if (!onlineAktiv || kanal || weg) return
    try {
      const sb = await client()
      uid = await nutzerId()
      const geraet = ich().geraet
      const k = sb.channel('snake-lobby', { config: { presence: { key: geraet }, broadcast: { self: false } } })
      k.on('presence', { event: 'sync' }, () => {
        const st = k.presenceState<OnlineSpieler>()
        const liste: OnlineSpieler[] = []
        for (const [key, eintraege] of Object.entries(st)) {
          const e = eintraege[eintraege.length - 1]
          if (key !== geraet && e?.name) liste.push({ geraet: key, uid: e.uid ?? null, name: e.name, skin: e.skin, imSpiel: !!e.imSpiel })
        }
        bei.liste(liste)
      })
      k.on('broadcast', { event: 'einladung' }, ({ payload }) => {
        const e = payload as Einladung
        if (e?.an === geraet) bei.einladung(e)
      })
      k.on('broadcast', { event: 'antwort' }, ({ payload }) => {
        const a = payload as Antwort
        if (a?.an === geraet) bei.antwort(a)
      })
      k.subscribe((status) => {
        if (status === 'SUBSCRIBED') void melden()
      })
      kanal = k
    } catch {
      /* kein Netz: beim naechsten Mal */
    }
  }
  return {
    start,
    /** Name, Skin oder "im Spiel" hat sich geaendert */
    melden,
    einladen(an: string, code: string, modus: string) {
      const i = ich()
      void kanal?.send({ type: 'broadcast', event: 'einladung', payload: { an, von: i.geraet, vonUid: uid, vonName: i.name, code, modus } satisfies Einladung })
    },
    antworten(an: string, ja: boolean) {
      const i = ich()
      void kanal?.send({ type: 'broadcast', event: 'antwort', payload: { an, von: i.geraet, vonName: i.name, ja } satisfies Antwort })
    },
    stop() {
      weg = true
      void kanal?.unsubscribe()
      kanal = null
    },
  }
}
