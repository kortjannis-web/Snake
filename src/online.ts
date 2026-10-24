/**
 * Online-Bestenliste ueber Supabase. Alles ist optional: ohne Zugangsdaten beim Bauen
 * (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) oder ohne Netz laeuft das Spiel unveraendert.
 * Der Supabase-Client wird erst bei Bedarf nachgeladen.
 */
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { kontoSchluessel, kontoZugang } from './konto'
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

/**
 * `offen`: Name, Skin oder Silber stehen noch nicht in der Datenbank (z. B. beim ersten Start ohne Netz).
 * `umbenennen`: der Name wurde geaendert und der Account muss noch auf den neuen Namen umgestellt werden.
 */
type Profil = { name: string; offen?: boolean; umbenennen?: boolean; skin?: string; silber?: number; /** Freundes-Code, sobald das Profil sicher in der Datenbank steht */ code?: string }
export const profil: Profil = { name: '', ...lies<Partial<Profil>>(PKEY, {}) }
const speichereProfil = () => schreib(PKEY, { name: profil.name, offen: profil.offen, umbenennen: profil.umbenennen, skin: profil.skin, silber: profil.silber, code: profil.code })
/** Zaehlt jede Aenderung an Name, Skin oder Silber: ein Speichern, das waehrenddessen lief, laesst `offen` dann stehen */
let profilStand = 0
const profilGeaendert = () => {
  profilStand++
  profil.offen = true
  speichereProfil()
}

/**
 * Wie steht es online um dieses Geraet? Fuer die Anzeige in der Hall of Snakes und bei den Freunden:
 * ok = das Profil steht in der Datenbank, sonst der letzte Fehler in Worten (und technisch, zum Weitergeben)
 */
export type OnlineZustand = { ok: boolean; text: string; technisch?: string }
let zustand: OnlineZustand = { ok: false, text: '' }
const zustandHoerer = new Set<(z: OnlineZustand) => void>()
function setzeZustand(z: OnlineZustand) {
  zustand = z
  for (const f of zustandHoerer) f(z)
}
export const onlineZustand = () => zustand
export function beiZustand(f: (z: OnlineZustand) => void) {
  zustandHoerer.add(f)
  return () => zustandHoerer.delete(f)
}
/** Fehler (Supabase, Netz, eigene) in Worten fuer den Spieler */
function fehlerWorte(e: unknown): OnlineZustand {
  const f = (e ?? {}) as { code?: string; status?: number; message?: string; name?: string }
  const technisch = [f.code, f.status, f.message].filter(Boolean).join(' · ') || String(e)
  const m = `${f.message ?? ''} ${f.code ?? ''}`
  const text =
    f.status === 429 || /rate limit|over_request|too many/i.test(m)
      ? 'Supabase bremst gerade die Anmeldungen (zu viele auf einmal). In ein paar Minuten klappt es.'
      : /abort|timeout|Zeit/i.test(m) || f.name === 'AbortError'
        ? 'Der Server antwortet nicht (Netz zu langsam). Gleich noch einmal versuchen.'
        : /fetch|network|Failed|Load failed|offline/i.test(m)
          ? 'Keine Verbindung zum Server. Bist du online?'
          : e instanceof NamenFehler
            ? f.message ?? 'Mit diesem Namen geht es nicht.'
            : 'Noch nicht in der Hall of Snakes eingetragen.'
  return { ok: false, text, technisch }
}
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
/** Der Name gehoert schon zu einem anderen Account (beim Umbenennen: anmelden statt umbenennen ist moeglich) */
export class NameVergeben extends NamenFehler {}
/** Der Name gehoert zu einem alten Gast-Account, der noch nicht auf Name umgestellt ist */
export class NameAlterGast extends NamenFehler {}
/** In Supabase ist die Anmeldung per E-Mail aus oder verlangt eine Bestaetigung (docs/ONLINE-EINRICHTEN.md, Schritt 2b) */
class EinrichtungsFehler extends Error {}

const namensFehler = (e: { code?: string; message?: string } | null) =>
  !e ? null : e.code === '23505' ? new NameVergeben('Diesen Namen gibt es schon.') : e.code === 'P0001' && /Name/.test(e.message ?? '') ? new NamenFehler('Dieser Name ist nicht erlaubt.') : null

/**
 * Jede Anfrage an Supabase hoechstens 15 s. Ohne Grenze bleibt eine Anfrage im schlechten Mobilnetz (WLAN-Wechsel,
 * Funkloch) manchmal ewig haengen, und alles, was danach kommt (Profil, Skin, Ergebnisse), wartet bis zum Neustart der App
 */
const FRIST = 15_000
const fetchMitFrist: typeof fetch = (input, init) => {
  const ab = new AbortController()
  const t = setTimeout(() => ab.abort(), FRIST)
  init?.signal?.addEventListener('abort', () => ab.abort())
  return fetch(input, { ...init, signal: ab.signal }).finally(() => clearTimeout(t))
}

let clientP: Promise<SupabaseClient> | null = null
function client(): Promise<SupabaseClient> {
  clientP ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true }, global: { fetch: fetchMitFrist }, realtime: { params: { eventsPerSecond: 5 } } }),
  )
  return clientP
}

/** Account-Schritte nie gleichzeitig (Start, Namensaenderung und Senden kommen sich sonst in die Quere).
 *  Haengt ein Schritt trotzdem, geht es nach 40 s mit dem naechsten weiter, statt fuer immer zu warten */
let kontoKette: Promise<unknown> = Promise.resolve()
function nacheinander<T>(f: () => Promise<T>): Promise<T> {
  const p = kontoKette.then(f)
  kontoKette = Promise.race([p.catch(() => undefined), new Promise((r) => setTimeout(r, 40_000))])
  return p
}

type AuthFehler = { code?: string; message?: string } | null
const falscheDaten = (e: AuthFehler) => !!e && (e.code === 'invalid_credentials' || /invalid login credentials/i.test(e.message ?? ''))
const einrichtungFehlt = (e: AuthFehler) => !!e && ['email_provider_disabled', 'signup_disabled', 'provider_disabled', 'email_not_confirmed', 'reauthentication_needed', 'weak_password'].includes(e.code ?? '')
const emailVergeben = (e: AuthFehler) => !!e && (e.code === 'email_exists' || e.code === 'user_already_exists' || /already (been )?registered/i.test(e.message ?? ''))

/** Mit dem Account dieses Namens anmelden. null: den Account gibt es (so) nicht */
async function anmeldenMitName(sb: SupabaseClient, name: string): Promise<User | null> {
  const { data, error } = await sb.auth.signInWithPassword(kontoZugang(name))
  if (!error && data.user) return data.user
  if (falscheDaten(error)) return null
  if (einrichtungFehlt(error)) throw new EinrichtungsFehler()
  throw error ?? new Error('Anmeldung fehlgeschlagen')
}

/** Gast-Anmeldung: Notnagel, wenn es keinen Account gibt (Nutzer-Id bleibt im Geraet). Laeuft hoechstens einmal gleichzeitig */
let idP: Promise<string> | null = null
function nutzerId(): Promise<string> {
  if (!idP) {
    const p = (async () => {
      const sb = await client()
      const { data } = await sb.auth.getSession()
      if (data.session) return data.session.user.id
      // Sitzung weg, aber der Name ist noch da: ueber den Namen wieder in den eigenen Account
      if (profil.name) {
        const u = await anmeldenMitName(sb, profil.name).catch((e) => (e instanceof EinrichtungsFehler ? null : Promise.reject(e)))
        if (u) return u.id
      }
      const { data: neu, error } = await sb.auth.signInAnonymously()
      if (error || !neu.user) throw error ?? new Error('Anmeldung fehlgeschlagen')
      return neu.user.id
    })()
    idP = p
    void p.then(() => undefined, () => undefined).then(() => (idP = idP === p ? null : idP))
  }
  return idP
}

/** Fehler: Spalte gibt es (noch) nicht (die SQL-Datei fuer den Skin wurde noch nicht ausgefuehrt) */
const spalteFehlt = (e: { code?: string } | null) => !!e && (e.code === '42703' || e.code === 'PGRST204')

/** Profil des Accounts aus der Datenbank uebernehmen (Name, Skin, Silber: das gilt fuer alle Geraete) */
async function uebernehmeProfil(sb: SupabaseClient, id: string) {
  let { data, error } = await sb.from('profile').select('name,skin,silber').eq('id', id).maybeSingle()
  if (spalteFehlt(error)) ({ data, error } = await sb.from('profile').select('name').eq('id', id).maybeSingle())
  if (error || !data) return
  const d = data as { name: string; skin?: string; silber?: number }
  profil.name = d.name
  if (d.skin) profil.skin = d.skin
  profil.silber = Math.max(profil.silber ?? 0, Number(d.silber ?? 0))
  speichereProfil()
}

/** Profil mit diesem Namen (ohne Gross-/Kleinschreibung) suchen */
async function profilMitName(sb: SupabaseClient, name: string): Promise<string | null> {
  const { data } = await sb.from('profile').select('id').ilike('name', name.replace(/[\\%_]/g, '\\$&')).limit(1)
  return (data as { id: string }[] | null)?.[0]?.id ?? null
}

/** Account mit den Zugangsdaten des Namens versehen: Gast-Account umwandeln (Id und alles dran bleibt) oder neu anlegen */
async function kontoAnlegen(sb: SupabaseClient, gast: User | null): Promise<string> {
  const z = kontoZugang(profil.name)
  if (gast) {
    const { data, error } = await sb.auth.updateUser(z)
    if (emailVergeben(error)) throw new NameVergeben('Diesen Namen gibt es schon.')
    if (einrichtungFehlt(error)) throw new EinrichtungsFehler()
    if (error) throw error
    // Mit Bestaetigungs-Pflicht bleibt die Adresse "wartend": dann ist die Einrichtung nicht fertig
    if (data.user?.email !== z.email) throw new EinrichtungsFehler()
    return gast.id
  }
  const { data, error } = await sb.auth.signUp(z)
  if (emailVergeben(error)) throw new NameVergeben('Diesen Namen gibt es schon.')
  if (einrichtungFehlt(error)) throw new EinrichtungsFehler()
  if (error) throw error
  if (!data.user || !data.session) throw new EinrichtungsFehler()
  return data.user.id
}

/** Eingeloggten Account auf den (neuen) Namen umstellen: erst Profilname (eindeutig?), dann Zugangsdaten */
async function kontoUmbenennen(sb: SupabaseClient, nutzer: User) {
  const { data: alt } = await sb.from('profile').select('name').eq('id', nutzer.id).maybeSingle()
  const { error: e1 } = await sb.from('profile').update({ name: profil.name, updated_at: new Date().toISOString() }).eq('id', nutzer.id)
  if (e1) throw namensFehler(e1) ?? e1
  const { data, error } = await sb.auth.updateUser(kontoZugang(profil.name))
  if (!error && data.user?.email === kontoZugang(profil.name).email) return
  // Zugangsdaten nicht umgestellt: Profilname zurueck, damit beides zusammenpasst
  if (alt) await sb.from('profile').update({ name: (alt as { name: string }).name }).eq('id', nutzer.id)
  if (emailVergeben(error)) throw new NameVergeben('Diesen Namen gibt es schon.')
  if (!error || einrichtungFehlt(error)) throw new EinrichtungsFehler()
  throw error
}

type Konto = { id: string; status: 'neu' | 'zurueck' | 'gleich' | 'umbenannt' | 'geraet' }

/**
 * Stellt sicher, dass dieses Geraet im Account zum Namen `profil.name` angemeldet ist:
 * - 'sichern' (Start, Senden): Account da? Dann bleibt er. Sonst mit dem Namen anmelden, den Gast-Account umwandeln oder neu anlegen
 * - 'umbenennen': eingeloggten Account auf den neuen Namen umstellen
 * - 'wechseln': ausdruecklich in den (anderen) Account dieses Namens wechseln
 * Ist die E-Mail-Anmeldung in Supabase nicht eingerichtet, laeuft alles wie vorher als Gast ('geraet').
 */
async function kontoBereit(modus: 'sichern' | 'umbenennen' | 'wechseln'): Promise<Konto> {
  const sb = await client()
  const { data: s } = await sb.auth.getSession()
  const nutzer = s.session?.user ?? null
  const hatKonto = !!nutzer?.email
  const ziel = kontoZugang(profil.name)

  if (nutzer && hatKonto && modus !== 'wechseln') {
    if (nutzer.email === ziel.email) return { id: nutzer.id, status: 'gleich' }
    if (modus === 'umbenennen') {
      try {
        await kontoUmbenennen(sb, nutzer)
        return { id: nutzer.id, status: 'umbenannt' }
      } catch (e) {
        if (e instanceof EinrichtungsFehler) return { id: nutzer.id, status: 'geraet' }
        throw e
      }
    }
    // Der Account wurde woanders umbenannt: dessen Namen uebernehmen
    await uebernehmeProfil(sb, nutzer.id)
    return { id: nutzer.id, status: 'gleich' }
  }

  try {
    const u = await anmeldenMitName(sb, profil.name)
    if (u) {
      await uebernehmeProfil(sb, u.id)
      return { id: u.id, status: 'zurueck' }
    }
    if (modus === 'wechseln') throw new NameAlterGast('Dieser Name gehört noch zu einem alten Gast-Account. Öffne Snake einmal auf dem Gerät, wo du ihn zuerst benutzt hast, dann geht er überall.')
    const gast = nutzer && !hatKonto ? nutzer : null
    const besitzer = await profilMitName(sb, profil.name)
    if (besitzer && besitzer !== gast?.id) throw new NameAlterGast('Diesen Namen gibt es schon (alter Gast-Account). Öffne Snake einmal auf dem Gerät, wo du ihn zuerst benutzt hast, dann geht er überall.')
    return { id: await kontoAnlegen(sb, gast), status: 'neu' }
  } catch (e) {
    if (!(e instanceof EinrichtungsFehler)) throw e
    // Notnagel: Account per Name ist nicht eingerichtet, also wie bisher ein Gast pro Geraet
    return { id: await nutzerId(), status: 'geraet' }
  }
}

/** Profil (Name) in die Datenbank schreiben. Wirft ohne Netz */
/** Fehler: Funktion gibt es (noch) nicht (SQL-Datei nicht ausgefuehrt) */
const funktionFehlt = (e: { code?: string } | null) => !!e && (e.code === 'PGRST202' || e.code === '42883')

async function syncProfil(modus: 'sichern' | 'umbenennen' | 'wechseln' = 'sichern'): Promise<Konto['status']> {
  return nacheinander(async () => {
    const { id, status } = await kontoBereit(modus)
    const sb = await client()
    const stand = profilStand
    // Erst ueber die Funktion profil_speichern (legt an oder aendert in einem Schritt, gibt den Freundes-Code zurueck)
    const { data: code, error: fe } = await sb.rpc('profil_speichern', { p_name: profil.name, p_skin: profil.skin ?? null, p_silber: profil.silber ? Math.floor(profil.silber) : null })
    if (!fe) profil.code = (code as string | null) ?? profil.code
    else if (fe.code === 'P0002') {
      // Der Account wurde geloescht, die Sitzung auf dem Geraet lebt aber noch: abmelden, beim naechsten Mal neu
      await sb.auth.signOut({ scope: 'local' }).catch(() => undefined)
      idP = null
      throw fe
    } else if (!funktionFehlt(fe)) throw namensFehler(fe) ?? fe
    else {
      // Aeltere Datenbank ohne profil_speichern: wie bisher direkt in die Tabelle
      // Eingeloggt in einen bestehenden Account: dort stehen Skin und Silber schon, nichts ueberschreiben
      const daten = { id, name: profil.name, updated_at: new Date().toISOString(), ...(profil.skin ? { skin: profil.skin } : {}), ...(profil.silber ? { silber: Math.floor(profil.silber) } : {}) }
      let { error } = await sb.from('profile').upsert(daten)
      // Spalte fehlt (SQL-Datei noch nicht ausgefuehrt): erst ohne Silber, dann nur mit Namen
      if (spalteFehlt(error) && 'silber' in daten) {
        const { silber: _s, ...ohne } = daten
        ;({ error } = await sb.from('profile').upsert(ohne))
      }
      if (spalteFehlt(error)) ({ error } = await sb.from('profile').upsert({ id, name: profil.name, updated_at: daten.updated_at }))
      if (error) throw namensFehler(error) ?? error
    }
    // Waehrend des Speicherns geaendert (z. B. neuer Skin): offen lassen, das naechste Senden nimmt es mit
    if (profilStand === stand) profil.offen = false
    profil.umbenennen = false
    speichereProfil()
    setzeZustand({ ok: true, text: `Online eingetragen als ${profil.name}.` })
    return status
  })
}

/** Silber-Trophaeen (alle je verdienten Aepfel) ins Profil, damit die Hall danach sortieren kann. Wird nie weniger */
export function setzeSilber(n: number) {
  if ((profil.silber ?? 0) >= n) return
  profil.silber = n
  if (!onlineAktiv || !profil.name) return speichereProfil()
  profilGeaendert()
  void sende()
}

/**
 * Skin geaendert: im Profil nachtragen, damit die anderen ihn in der Spielerliste sehen.
 * `nurNachtragen`: beim Start nur, wenn das Profil noch keinen hat (ein anderes Geraet desselben Accounts hat ihn vielleicht gesetzt)
 */
export function setzeSkin(skin: string, nurNachtragen = false) {
  if (profil.skin === skin || (nurNachtragen && profil.skin)) return
  profil.skin = skin
  if (!onlineAktiv || !profil.name) return speichereProfil()
  profilGeaendert()
  void sende()
}

/**
 * Name speichern. Er gilt sofort auf dem Geraet, auch ohne Netz; in die Datenbank kommt er,
 * sobald es geht.
 * - 'neu': Account mit diesem Namen angelegt
 * - 'zurueck': den Account mit diesem Namen gibt es schon, dieses Geraet ist jetzt darin angemeldet
 * - 'umbenannt': der Account heisst jetzt so
 * - 'spaeter': kein Netz, wird nachgeholt
 * `wechseln`: ausdruecklich in den schon vorhandenen Account dieses Namens wechseln (statt umzubenennen)
 */
export type NameErgebnis = 'neu' | 'zurueck' | 'umbenannt' | 'spaeter'
export async function setzeName(name: string, wechseln = false): Promise<NameErgebnis> {
  const n = name.trim()
  if (!nameErlaubt(n)) throw new NamenFehler('Dieser Name ist nicht erlaubt.')
  if (!nameGueltig(n)) throw new NamenFehler('Der Name braucht 2 bis 16 Zeichen.')
  const vorher = { ...profil }
  const hatteName = !!profil.name
  const gleich = hatteName && kontoSchluessel(vorher.name) === kontoSchluessel(n)
  profil.name = n
  profil.umbenennen = hatteName && !gleich && !wechseln
  profilGeaendert()
  if (!onlineAktiv) return 'spaeter'
  try {
    const status = await syncProfil(wechseln ? 'wechseln' : profil.umbenennen ? 'umbenennen' : 'sichern')
    void sende()
    return status === 'neu' || status === 'zurueck' || status === 'umbenannt' ? status : hatteName ? 'umbenannt' : 'neu'
  } catch (e) {
    // Vergeben oder nicht erlaubt: alten Namen behalten und Bescheid geben. Ohne Netz: spaeter
    if (e instanceof NamenFehler) {
      Object.assign(profil, vorher)
      speichereProfil()
      throw e
    }
    setzeZustand(fehlerWorte(e))
    return 'spaeter'
  }
}

/** Antwort des Servers: diese Sitzung gilt nicht (mehr), z. B. weil der Account geloescht wurde */
const sitzungUngueltig = (e: { status?: number; code?: string } | null) =>
  !!e && (e.status === 401 || e.status === 403 || ['user_not_found', 'bad_jwt', 'session_not_found', 'session_expired', 'refresh_token_not_found'].includes(e.code ?? ''))

let zuletztGesichert = 0
/**
 * Beim Start, wenn das Netz zurueckkommt und wenn die App wieder nach vorn kommt (hoechstens jede Minute):
 * Account sichern (alten Gast-Account auf den Namen umstellen, nach verlorener Sitzung wieder anmelden, Umbenennungen
 * von anderen Geraeten uebernehmen) und pruefen, ob das Profil wirklich in der Datenbank steht. Fehlt es (Eintrag ging
 * verloren, Account geloescht, Sitzung ungueltig), wird es neu angelegt: wer einen Namen hat, steht in der Hall of Snakes.
 */
export function kontoSichern() {
  if (!onlineAktiv || !profil.name || Date.now() - zuletztGesichert < 60_000) return
  zuletztGesichert = Date.now()
  void nacheinander(async () => {
    try {
      const sb = await client()
      // Die gespeicherte Sitzung beim Server pruefen (getSession glaubt dem Geraet): ungueltig = abmelden, dann neu
      const { data: s } = await sb.auth.getSession()
      if (s.session) {
        const { error } = await sb.auth.getUser()
        if (sitzungUngueltig(error)) {
          await sb.auth.signOut({ scope: 'local' }).catch(() => undefined)
          idP = null
          // Gibt es den Account zum Namen noch? Nein: er wurde geloescht (Admin). Dann nicht heimlich neu anlegen,
          // sondern den Namen auf dem Geraet vergessen: beim naechsten Start kommt die Namenswahl
          const u = await anmeldenMitName(sb, profil.name).catch((e) => (e instanceof EinrichtungsFehler ? undefined : Promise.reject(e)))
          if (u === null && s.session.user.email) {
            profilVergessen()
            return
          }
        }
      }
      const { id, status } = await kontoBereit(profil.umbenennen ? 'umbenennen' : 'sichern')
      const { data, error } = await sb.from('profile').select('id').eq('id', id).maybeSingle()
      // Frisch angelegt oder der Eintrag fehlt: das Profil muss (wieder) in die Datenbank
      if (status === 'neu' || (!error && !data)) profilGeaendert()
      else if (!error && data && !profil.offen) setzeZustand({ ok: true, text: `Online eingetragen als ${profil.name}.` })
    } catch (e) {
      /* kein Netz oder Name belegt: beim naechsten Mal wieder */
      zuletztGesichert = 0
      setzeZustand(fehlerWorte(e))
    }
  }).then(() => void sende())
}

let sendeP: Promise<void> | null = null
let nochmalSenden = false
let sendeTimer = 0
/**
 * Name, Skin, Silber und wartende Ergebnisse senden. Ohne Netz bleibt alles liegen und kommt beim naechsten Mal dran.
 * Kommt waehrend des Sendens etwas Neues dazu (neuer Skin, neues Ergebnis), wird gleich danach noch einmal gesendet:
 * frueher ging das verloren, bis zufaellig wieder etwas gesendet wurde
 */
export function sende(): Promise<void> {
  if (!onlineAktiv || !profil.name || (!profil.offen && !warteschlange.length)) return sendeP ?? Promise.resolve()
  if (sendeP) {
    nochmalSenden = true
    return sendeP
  }
  sendeP = (async () => {
    let runden = 0
    do {
      nochmalSenden = false
      await sendeEinmal()
    } while (nochmalSenden && ++runden < 5)
  })().finally(() => (sendeP = null))
  return sendeP
}

/** Spaeter noch einmal senden (z. B. nach "zu schnell hintereinander") */
function spaeterSenden(ms: number) {
  clearTimeout(sendeTimer)
  sendeTimer = window.setTimeout(() => void sende(), ms)
}

async function sendeEinmal() {
  try {
    if (profil.offen) {
      try {
        await syncProfil(profil.umbenennen ? 'umbenennen' : 'sichern')
      } catch (e) {
        if (!(e instanceof NamenFehler)) throw e
        // Name gehoert schon einem anderen Account (und laesst sich hier nicht anmelden): mit Nummer eintragen,
        // damit der Spieler wenigstens sichtbar ist. Er kann den Namen jederzeit in der Hall of Snakes aendern
        profil.name = `${profil.name.slice(0, 12)} ${Math.floor(10 + Math.random() * 90)}`
        profil.umbenennen = false
        profilStand++
        await syncProfil()
      }
    }
    const sb = await client()
    const id = await nutzerId()
    // Das beste Ergebnis zuerst: kommt etwas dazwischen, ist wenigstens der Rekord angekommen
    warteschlange.sort((a, b) => b.level - a.level)
    while (warteschlange.length) {
      const e = warteschlange[0]
      const zeile: Record<string, unknown> = { user_id: id, level: e.level, dauer_ms: e.dauer, tempo: e.tempo, version: __APP_VERSION__ }
      let { error } = await sb.from('score').insert(e.tages ? { ...zeile, tages: true } : zeile)
      // Tages-Spalte fehlt noch (SQL-Datei 5 nicht ausgefuehrt): als normales Ergebnis eintragen
      if (e.tages && spalteFehlt(error)) ({ error } = await sb.from('score').insert(zeile))
      // Zu schnell hintereinander: nicht wegwerfen, sondern gleich noch einmal
      if (error && /zu schnell/.test(error.message ?? '')) {
        spaeterSenden(4000)
        break
      }
      // Profil fehlt in der Datenbank (Fremdschluessel): erst das Profil, dann die Ergebnisse
      if (error?.code === '23503') {
        profilGeaendert()
        spaeterSenden(2000)
        break
      }
      // Dauerhaft abgelehnt (Regel verletzt): wegwerfen. Netzfehler und Anmeldung: spaeter nochmal
      if (error && error.code !== '23514' && error.code !== 'P0001') throw error
      warteschlange.shift()
      schreib(QKEY, warteschlange)
    }
  } catch (e) {
    /* kein Netz: beim naechsten Mal */
    setzeZustand(fehlerWorte(e))
  }
}

/**
 * "Neu verbinden" (Knopf in der Hall of Snakes): Sitzung beim Server pruefen, kaputte Sitzung verwerfen, ueber den Namen
 * neu anmelden und Profil samt allem Wartenden neu eintragen. Gibt den Zustand danach zurueck
 */
export async function kontoReparieren(): Promise<OnlineZustand> {
  if (!onlineAktiv || !profil.name) return zustand
  setzeZustand({ ok: false, text: 'Verbinde …' })
  try {
    await nacheinander(async () => {
      const sb = await client()
      const { data: s } = await sb.auth.getSession()
      if (!s.session) return
      const { error } = await sb.auth.getUser()
      if (sitzungUngueltig(error)) {
        await sb.auth.signOut({ scope: 'local' }).catch(() => undefined)
        idP = null
      } else if (error) throw error
    })
  } catch (e) {
    setzeZustand(fehlerWorte(e))
    return zustand
  }
  zuletztGesichert = 0
  profilGeaendert()
  await sende()
  if (!profil.offen) setzeZustand({ ok: true, text: `Online eingetragen als ${profil.name}.` })
  return zustand
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
  kontoSichern()
  void sende()
  window.addEventListener('online', () => {
    zuletztGesichert = 0
    kontoSichern()
  })
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
    if (error) return profil.code ?? null
    const code = (data as string | null) ?? null
    if (code !== (profil.code ?? null)) {
      profil.code = code ?? undefined
      speichereProfil()
    }
    // Kein Code = kein Profil in der Datenbank: der Spieler ist fuer alle unsichtbar. Gleich neu eintragen
    if (!code) {
      profilGeaendert()
      void sende()
    }
    return code
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
/** Eigenes Online-Konto loeschen (Profil, Ergebnisse, Freunde, Nachrichten). Auf dem Geraet bleiben Spielstand und Einstellungen */
export async function kontoLoeschen() {
  await nutzerId()
  const sb = await client()
  const { error } = await sb.rpc('konto_loeschen')
  if (error) throw new Error(error.code === 'P0001' ? fehlerText(error) : `${fehlerText(error)} (${error.code ?? '?'}: ${error.message})`)
  await sb.auth.signOut({ scope: 'local' }).catch(() => undefined)
  profilVergessen()
}

/** Online-Profil auf dem Geraet leeren (Spielstand und Einstellungen bleiben) */
function profilVergessen() {
  profil.name = ''
  profil.offen = profil.umbenennen = undefined
  profil.skin = profil.silber = undefined
  speichereProfil()
  warteschlange.length = 0
  schreib(QKEY, warteschlange)
  idP = null
}

export async function adminLoeschen(code: string, ziel: string) {
  await nutzerId() // ohne Sitzung laeuft der Aufruf als anonym und die Datenbank lehnt ihn ab
  const sb = await client()
  const { error } = await sb.rpc('admin_spieler_loeschen', { code, ziel })
  if (!error) return
  // Funktion fehlt (SQL nie in Supabase ausgefuehrt): sagen, was zu tun ist, statt "Bist du online?"
  if (error.code === 'PGRST202' || error.code === '42883')
    throw new Error('Die Löschfunktion fehlt in der Datenbank. Einmal die Datei supabase/NACHHOLEN.sql im Supabase SQL Editor ausführen (Anleitung: docs/SPIELER-LOESCHEN.md).')
  throw new Error(error.code === 'P0001' ? fehlerText(error) : `${fehlerText(error)} (${error.code ?? '?'}: ${error.message})`)
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

/** Eigenen Sieg eintragen. trophaeen: so viele Gold-Trophaeen (je besiegtem Gegner, bei 3 Leben doppelt, hoechstens 6) */
export async function meldeSieg(modus: string, trophaeen: number) {
  if (!onlineAktiv || !profil.name) return
  try {
    const sb = await client()
    const id = await nutzerId()
    const { error } = await sb.from('sieg').insert({ user_id: id, modus, gegner: Math.max(1, Math.min(6, trophaeen)) })
    // Datenbank noch ohne die Migration fuer 3 Leben (hoechstens 3): dann so viel wie erlaubt
    if (error?.code === '23514' && trophaeen > 3) await sb.from('sieg').insert({ user_id: id, modus, gegner: 3 })
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
export async function pushSpeichern(abo: PushSubscriptionJSON | null): Promise<string | null> {
  if (!onlineAktiv) return 'Online nicht eingerichtet'
  if (!profil.name) return 'noch kein Name'
  try {
    await nutzerId()
    const sb = await client()
    const { error } = await sb.rpc('push_setzen', { abo })
    return error ? `${error.code ?? '?'}: ${error.message}` : null
  } catch (e) {
    return e instanceof Error ? e.message : 'keine Verbindung'
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
  let laeuft = false
  let nochmal: ReturnType<typeof setTimeout> | null = null
  /** Verbindung weg oder Start ging schief (kein Netz beim App-Start, Server kurz weg): spaeter neu versuchen,
   *  sonst bleibt der Spieler die ganze Sitzung fuer alle anderen unsichtbar */
  const spaeter = (ms: number) => {
    if (weg || nochmal) return
    nochmal = setTimeout(() => {
      nochmal = null
      void start()
    }, ms)
  }
  const melden = async () => {
    if (!kanal) return
    const i = ich()
    if (!i.name) return
    try {
      // Die Nutzer-Id jedes Mal frisch holen: nach Anmelden mit dem Namen oder Kontowechsel ist es eine andere,
      // und mit der alten Id erscheint der Spieler in der Hall of Snakes und bei Freunden nicht als online
      uid = await nutzerId().catch(() => uid)
      await kanal.track({ ...i, uid })
    } catch {
      /* noch nicht verbunden */
    }
  }
  const start = async () => {
    if (!onlineAktiv || kanal || weg || laeuft) return
    laeuft = true
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
        else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') && kanal === k && !weg) {
          // Kanal kaputt: abbauen und neu aufbauen
          kanal = null
          void sb.removeChannel(k)
          spaeter(5000)
        }
      })
      kanal = k
    } catch {
      spaeter(15_000)
    } finally {
      laeuft = false
    }
  }
  return {
    start,
    /** App wieder im Vordergrund: Verbindung pruefen und neu melden */
    wieder() {
      if (kanal) void melden()
      else void start()
    },
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
      if (nochmal) clearTimeout(nochmal)
      void kanal?.unsubscribe()
      kanal = null
    },
  }
}
