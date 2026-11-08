/**
 * Spielstand in der Cloud: Aepfel, Skins, Welten, Rekorde, Statistik, Erfolge und die Kampagne gehoeren zum Account.
 * Seit 1.56.0 ist der Server die einzige Wahrheit (supabase/migrations/20261108000000_spielstand_server.sql):
 *
 * - Die App schreibt nicht mehr selbst in `spielstand`. Sie schickt der Funktion `spielstand_abgleichen`, was sie hat, und
 *   welchen Stand des Servers sie zuletzt kannte (`basis`). Die Datenbank fuehrt zusammen und gibt den ganzen Stand zurueck:
 *   Zaehler (Aepfel, Spiele, Spielzeit ...) als Aenderung seit `basis`, nie unter 0; Bestwerte nur nach oben; Listen (Skins,
 *   Welten, Erfolge) nur vereinigen; Auswahl (Skin, Aussehen, Welt) das, was hier geaendert wurde, sonst der Server.
 * - Jede Anfrage hat eine Kennung (`vorgang`) und liegt auf dem Geraet, bis der Server sie bestaetigt hat. Geht die Antwort
 *   verloren, wird dieselbe Anfrage noch einmal geschickt; der Server rechnet sie nicht doppelt.
 * - Live: Jedes Geraet hoert auf seine Zeile in `spielstand` und `kampagne` (Supabase Realtime) und gleicht sofort ab.
 *   Dazu beim Start, beim Zurueckkommen in die App, wenn das Netz wiederkommt und alle 45 s als Sicherheitsnetz.
 * - Gesendet wird kurz nach jedem Speichern (Level, Mission, Kauf, Rekord) und sofort beim Verlassen der App.
 * - Wem gehoert der Stand auf dem Geraet? Dem Account, mit dem zuletzt abgeglichen wurde. Meldet sich ein anderer an, wird
 *   das, was hier noch nicht beim alten Account angekommen ist, fuer ihn zurueckgelegt (kommt beim naechsten Anmelden dazu);
 *   dann gilt der Stand des neuen Accounts. Hat der noch keinen (neuer Account), bekommt er den vom Geraet.
 * - Offline geht alles weiter wie bisher; der naechste Abgleich holt es nach, der Server wird dabei nie verkleinert.
 *
 * Dazu gehoeren auch: Spielfuehrer gesehen, Patchnotes gesehen, Weltchat gelesen bis (`konto`). Geraeteeinstellungen
 * (Ton, Vibration, Steuerung, Aufloesung, Admin) bleiben auf dem Geraet.
 */
import { beiKampagne, kampagne, kampagneGleich, kampagneLeer, kampagneSauber, kampagneSeit, kampagneUebernehmen, kampagneZusammen, type KampagnenStand } from './kampagne'
import { beiSpielstand, defaultStats, saveStats, saveWallet, stats, wallet } from './storage'
import { beiZustand, sitzung } from './online'

type Wert = unknown
export type Daten = { wallet?: Record<string, Wert>; stats?: Record<string, Wert>; konto?: Record<string, Wert> }

/** Bestwerte: nie kleiner werden, nie aufaddieren (wie public.ss_bestwert in der Datenbank) */
const BESTWERTE = new Set(['best', 'longest', 'maxGebiete', 'verdient', 'weltBest', 'weltchat'])
/** Auswahl als Ganzes (nicht Feld fuer Feld mischen, sonst entstehen Farben, die niemand gewaehlt hat) */
const AUSWAHL = new Set(['look'])

const istObjekt = (v: Wert): v is Record<string, Wert> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Gleicher Inhalt? Reihenfolge der Felder egal, Reihenfolge in Listen nicht */
export function gleich(a: Wert, b: Wert): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => gleich(x, b[i]))
  if (istObjekt(a) && istObjekt(b)) {
    const ka = Object.keys(a).filter((k) => a[k] !== undefined)
    const kb = Object.keys(b).filter((k) => b[k] !== undefined)
    return ka.length === kb.length && ka.every((k) => gleich(a[k], b[k]))
  }
  return false
}

/** Drei-Wege-Zusammenfuehrung (rein, ohne Netz; gleiche Regeln wie public.ss_zusammen, getestet in test/cloud.test.ts) */
export function zusammenfuehren(basis: Wert, lokal: Wert, cloud: Wert, bestwert = false, auswahl = false): Wert {
  if (cloud === undefined) return lokal
  if (lokal === undefined) return cloud
  if (auswahl) return basis !== undefined && !gleich(lokal, basis) ? lokal : cloud
  if (typeof lokal === 'number' && typeof cloud === 'number') {
    if (bestwert || typeof basis !== 'number') return Math.max(lokal, cloud)
    return Math.max(0, cloud + (lokal - basis))
  }
  if (Array.isArray(lokal) && Array.isArray(cloud)) {
    const aus: Wert[] = []
    for (const x of [...cloud, ...lokal]) if (!aus.some((y) => gleich(x, y))) aus.push(x)
    return aus
  }
  if (istObjekt(lokal) && istObjekt(cloud)) {
    const b = istObjekt(basis) ? basis : {}
    const aus: Record<string, Wert> = {}
    for (const k of new Set([...Object.keys(cloud), ...Object.keys(lokal)])) aus[k] = zusammenfuehren(b[k], lokal[k], cloud[k], bestwert || BESTWERTE.has(k), AUSWAHL.has(k))
    return aus
  }
  // Auswahl und Text: hier geaendert? Dann gilt das, sonst die Cloud
  return basis !== undefined && !gleich(lokal, basis) ? lokal : cloud
}

/** Tagesbestwert nur fuer denselben Tag zusammenfuehren (sonst gilt der neuere Tag) */
function heuteRichten(aus: Record<string, Wert>, lokal: Record<string, Wert>, cloud: Record<string, Wert>) {
  const l = lokal.heute as { datum: string; best: number } | undefined
  const c = cloud.heute as { datum: string; best: number } | undefined
  if (!istObjekt(l) || !istObjekt(c)) return
  aus.heute = l.datum === c.datum ? { datum: l.datum, best: Math.max(l.best ?? 0, c.best ?? 0) } : (l.datum ?? '') > (c.datum ?? '') ? l : c
}

/** Angefangene Aepfel (Hundertstel) gehoeren zum Geraet: nie senden, nie uebernehmen */
export function ohneRest(d: Daten): Daten {
  if (!istObjekt(d.wallet) || !('rest' in d.wallet)) return d
  const { rest: _r, ...w } = d.wallet
  return { ...d, wallet: w }
}

/** Ganzer Spielstand (gleiche Regeln wie public.ss_spielstand in der Datenbank) */
export function spielstandZusammen(basis: Daten | null, lokal: Daten, cloud: Daten | null): Daten {
  if (!cloud) return lokal
  const l = ohneRest(lokal)
  const aus = zusammenfuehren(basis ? ohneRest(basis) : undefined, l, cloud) as Daten
  if (istObjekt(l.stats) && istObjekt(cloud.stats) && istObjekt(aus.stats)) heuteRichten(aus.stats, l.stats, cloud.stats)
  return aus
}

/* ---------------- Was auf dem Geraet zum Account gehoert ---------------- */

/** Kleine Merker, die zum Account gehoeren (liegen weiter unter ihren alten Schluesseln, damit main.ts sie wie bisher liest) */
const KONTO_FELDER: { feld: string; key: string; lesen: (raw: string) => Wert; schreiben: (v: Wert) => string }[] = [
  { feld: 'fuehrer', key: 'snake.fuehrer', lesen: (r) => (JSON.parse(r) as { v?: string }).v, schreiben: (v) => JSON.stringify({ v }) },
  { feld: 'patchnotes', key: 'snake.patchnotes', lesen: (r) => (JSON.parse(r) as { v?: string }).v, schreiben: (v) => JSON.stringify({ v }) },
  { feld: 'weltchat', key: 'snake.welt.gesehen.v1', lesen: (r) => Number(r) || undefined, schreiben: (v) => String(v) },
]
function kontoLesen(): Record<string, Wert> {
  const aus: Record<string, Wert> = {}
  for (const f of KONTO_FELDER) {
    try {
      const raw = localStorage.getItem(f.key)
      const v = raw ? f.lesen(raw) : undefined
      if (v !== undefined && v !== null && v !== '') aus[f.feld] = v
    } catch {
      /* unlesbar: zaehlt als nicht gesetzt */
    }
  }
  return aus
}
function kontoSchreiben(k: Record<string, Wert> | undefined) {
  if (!k) return
  for (const f of KONTO_FELDER) {
    const v = k[f.feld]
    if (v === undefined || v === null || (typeof v !== 'string' && typeof v !== 'number')) continue
    try {
      localStorage.setItem(f.key, f.schreiben(v))
    } catch {
      /* Speicher blockiert */
    }
  }
}

const kopie = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
/** Der Stand auf dem Geraet, so wie er zum Server geht (ohne angefangene Aepfel) */
export const lokaleDaten = (): Daten => ohneRest(kopie({ wallet: wallet as unknown as Record<string, Wert>, stats: stats as unknown as Record<string, Wert>, konto: kontoLesen() }))

const hoerer = new Set<() => void>()
/** Ruft `f` auf, sobald ein Abgleich den Spielstand auf diesem Geraet veraendert hat (Startbildschirm neu zeichnen) */
export function beiCloud(f: () => void) {
  hoerer.add(f)
}

const WALLET_LEER = () => ({ aepfel: 0, skins: ['klassik'], skin: 'klassik', trophaeen: 0 })

/**
 * Ergebnis auf dem Geraet uebernehmen, ohne erneut einen Abgleich auszuloesen.
 * `ersetzen`: Stand eines anderen Accounts, nichts vom alten bleibt stehen (ausser den angefangenen Aepfeln)
 */
let uebernehme = false
function anwenden(d: Daten, ersetzen: boolean) {
  uebernehme = true
  try {
    const rest = wallet.rest
    if (ersetzen) {
      for (const k of Object.keys(wallet)) delete (wallet as Record<string, Wert>)[k]
      for (const k of Object.keys(stats)) delete (stats as Record<string, Wert>)[k]
      Object.assign(wallet, WALLET_LEER())
      Object.assign(stats, defaultStats())
    }
    if (istObjekt(d.wallet)) Object.assign(wallet, d.wallet)
    if (istObjekt(d.stats)) Object.assign(stats, d.stats)
    if (rest !== undefined) wallet.rest = rest
    else delete wallet.rest
    kontoSchreiben(istObjekt(d.konto) ? d.konto : undefined)
    saveWallet()
    saveStats()
  } finally {
    uebernehme = false
  }
  hoerer.forEach((f) => f())
}

/* ---------------- Abgleich mit dem Server ---------------- */

const BKEY = 'snake.cloud.v1'
/** Letzter bestaetigter Stand des Servers auf diesem Geraet: fuer welchen Account, welcher Stand, welche Daten */
type Basis = { uid: string; stand: number; daten: Daten }
function liesBasis(): Basis | null {
  const b = liesJson<Basis>(BKEY)
  return b && typeof b.uid === 'string' && istObjekt(b.daten) ? { ...b, daten: ohneRest(b.daten) } : null
}

/** Anfrage, die der Server noch nicht bestaetigt hat (je Account, in Reihenfolge) */
export type Vorgang = { vorgang: string; basis: Daten | null; lokal: Daten; gesendet?: boolean }
const OKEY = 'snake.cloud.offen.v1'
const liesOffen = (): Record<string, Vorgang[]> => {
  const o = liesJson<Record<string, Vorgang[]>>(OKEY)
  return istObjekt(o) ? (o as Record<string, Vorgang[]>) : {}
}
const schreibOffen = (o: Record<string, Vorgang[]>) => {
  for (const k of Object.keys(o)) if (!o[k]?.length) delete o[k]
  schreibJson(OKEY, o)
}

const neueId = (): string => {
  try {
    if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID()
  } catch {
    /* unten von Hand */
  }
  const h = [...Array(32)].map(() => Math.floor(Math.random() * 16).toString(16))
  h[12] = '4'
  h[16] = ((parseInt(h[16], 16) & 3) | 8).toString(16)
  const s = h.join('')
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`
}

/**
 * Was auf dem Geraet seit dem letzten bestaetigten Stand dazukam, als Vorgang fuer seinen Besitzer ablegen (rein, getestet).
 * Ein noch nie gesendeter letzter Vorgang wird fortgeschrieben statt einen neuen anzulegen.
 */
export function vorgangAblegen(offen: Record<string, Vorgang[]>, besitzer: string, basis: Basis | null, lokal: Daten, id: () => string = neueId): boolean {
  const liste = offen[besitzer] ?? []
  const letzter = liste[liste.length - 1]
  const start = letzter ? letzter.lokal : basis?.uid === besitzer ? basis.daten : null
  if (start && gleich(start, lokal)) return false
  if (letzter && !letzter.gesendet) letzter.lokal = lokal
  else liste.push({ vorgang: id(), basis: start, lokal })
  offen[besitzer] = liste
  return true
}

type Antwort = { daten: Daten; stand: number }
type Sitzung = NonNullable<Awaited<ReturnType<typeof sitzung>>>

/** Tabelle oder Funktion fehlt in der Datenbank (SQL noch nicht eingespielt): still warten */
const fehltNoch = (e: { code?: string } | null) => !!e && ['42P01', '42883', 'PGRST202', 'PGRST205'].includes(e.code ?? '')

async function rufeAbgleich(z: Sitzung, vorgang: string | null, basis: Daten | null, lokal: Daten | null): Promise<Antwort | null> {
  const { data, error } = await z.sb.rpc('spielstand_abgleichen', { p_vorgang: vorgang, p_basis: basis, p_lokal: lokal })
  if (error) {
    if (!fehltNoch(error)) console.warn('Spielstand: Abgleich fehlgeschlagen', error)
    return null
  }
  const d = (data ?? {}) as { daten?: Daten; stand?: number }
  return { daten: ohneRest(istObjekt(d.daten) ? d.daten : {}), stand: Number(d.stand ?? 0) }
}

/** Offene Vorgaenge dieses Accounts der Reihe nach senden. null: abgebrochen (Netz), sonst die letzte Antwort (oder undefined) */
async function offeneSenden(z: Sitzung): Promise<Antwort | null | undefined> {
  let r: Antwort | undefined
  for (;;) {
    const offen = liesOffen()
    const v = offen[z.id]?.[0]
    if (!v) return r
    if (!v.gesendet) {
      v.gesendet = true
      schreibOffen(offen)
    }
    const a = await rufeAbgleich(z, v.vorgang, v.basis, v.lokal)
    if (!a) return null
    r = a
    const jetzt = liesOffen()
    jetzt[z.id] = (jetzt[z.id] ?? []).filter((x) => x.vorgang !== v.vorgang)
    schreibOffen(jetzt)
  }
}

let laeuft: Promise<void> | null = null
let nochmal = false
/**
 * Mit dem Server abgleichen: Neues vom Geraet als Vorgang ablegen, offene Vorgaenge senden, Ergebnis uebernehmen.
 * Ohne Anmeldung oder Netz passiert nichts (die Vorgaenge bleiben liegen, der naechste Abgleich holt es nach).
 */
export function abgleichen(): Promise<void> {
  if (laeuft) {
    nochmal = true
    return laeuft
  }
  laeuft = (async () => {
    for (let runde = 0; runde < 4; runde++) {
      nochmal = false
      const z = await sitzung().catch(() => null)
      if (!z) return
      const alt = liesBasis()
      const vorher = lokaleDaten()
      const besitzer = alt?.uid ?? z.id
      const offen = liesOffen()
      if (vorgangAblegen(offen, besitzer, alt, vorher)) schreibOffen(offen)
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return

      let r = await offeneSenden(z)
      if (r === null) return
      let ersetzen = false
      if (besitzer !== z.id) {
        // Anderer Account als zuletzt: hat er schon einen Spielstand, gilt seiner; sonst bekommt er den vom Geraet
        r ??= (await rufeAbgleich(z, null, null, null)) ?? undefined
        if (!r) return
        if (r.stand === 0) {
          const id = neueId()
          const o = liesOffen()
          o[z.id] = [...(o[z.id] ?? []), { vorgang: id, basis: null, lokal: vorher }]
          schreibOffen(o)
          r = await offeneSenden(z)
          if (!r) return
        } else ersetzen = true
      }
      r ??= (await rufeAbgleich(z, null, null, null)) ?? undefined
      if (!r) return

      // Ergebnis uebernehmen. Was waehrend der Anfragen hier dazukam, bleibt (Drei-Wege mit `vorher` als Basis)
      const jetzt = lokaleDaten()
      const neu = ersetzen ? r.daten : spielstandZusammen(vorher, jetzt, r.daten)
      if (ersetzen || !gleich(neu, jetzt)) anwenden(neu, ersetzen)
      schreibJson(BKEY, { uid: z.id, stand: r.stand, daten: r.daten } satisfies Basis)
      if (!gleich(neu, r.daten)) nochmal = true
      if (!nochmal) return
    }
  })().finally(() => (laeuft = null))
  return laeuft
}

let timer = 0
/** Nach dem Speichern (Level, Mission, Kauf, Rekord): kurz sammeln, dann abgleichen */
beiSpielstand.add(() => {
  if (uebernehme) return
  clearTimeout(timer)
  timer = window.setTimeout(() => void abgleichen(), 800)
})

/** Letzter bestaetigter Stand (fuer den Live-Abgleich: eigene Aenderung oder schon bekannt?) */
const basisStand = () => liesBasis()?.stand ?? -1

/* ---------------- Kampagne in der Cloud (seit 1.55.3) ----------------
 * Eigene Tabelle `kampagne` (supabase/migrations/20261106000000_kampagne.sql). Die App schickt ihren Stand an
 * `kampagne_abgleichen`; die Datenbank legt ihn zum gespeicherten dazu (nur dazu, nie weg) und gibt alles zurueck.
 * Aeltere Apps kennen die Tabelle nicht und koennen sie deshalb auch nicht ueberschreiben.
 *
 * Wem gehoert der Stand auf dem Geraet? Dem Account, mit dem er zuletzt abgeglichen wurde (KONTO_KEY).
 * - Erster Abgleich ueberhaupt (bis 1.55.2 lag die Kampagne nur hier): er kommt zum angemeldeten Account.
 * - Gleicher Account: Geraet und Cloud zusammen.
 * - Anderer Account als zuletzt: der Stand hier wird fuer den alten Account auf dem Geraet zurueckgelegt (SICHERUNG_KEY,
 *   kommt beim naechsten Anmelden mit ihm dazu). Hat der neue Account schon eine Kampagne, gilt seine; ist sie leer
 *   (neuer Account, z. B. nach Konto loeschen), bekommt er den Stand vom Geraet, wie Aepfel und Skins auch.
 * Fehlt die Tabelle (SQL noch nicht eingespielt) oder das Netz, bleibt alles wie es ist; der naechste Abgleich holt es nach.
 */
const KONTO_KEY = 'snake.cloud.kampagne.konto'
const SICHERUNG_KEY = 'snake.cloud.kampagne.sicherung'

function liesJson<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null
  } catch {
    return null
  }
}
function schreibJson(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* Speicher blockiert: beim naechsten Mal noch einmal */
  }
}
const liesSicherung = (): Record<string, KampagnenStand> => {
  const roh = liesJson<Record<string, unknown>>(SICHERUNG_KEY)
  const aus: Record<string, KampagnenStand> = {}
  if (roh && typeof roh === 'object') for (const [uid, k] of Object.entries(roh)) aus[uid] = kampagneSauber(k)
  return aus
}

const LEER: KampagnenStand = { geschafft: [], erreicht: {} }

/**
 * Was hochgeladen wird und ob der Stand hier danach durch den der Cloud ersetzt wird (rein, getestet in test/kampagne-cloud.test.ts).
 * `cloud`: der gespeicherte Stand des angemeldeten Accounts (nur bei einem Wechsel gelesen, sonst egal).
 */
export function kampagnePlan(p: {
  altUid: string | null
  uid: string
  lokal: KampagnenStand
  cloud: KampagnenStand | null
  sicherung: Record<string, KampagnenStand>
}): { hoch: KampagnenStand; ersetzen: boolean; zuruecklegen: KampagnenStand | null } {
  const eigeneSicherung = p.sicherung[p.uid] ?? LEER
  if (!p.altUid || p.altUid === p.uid) return { hoch: kampagneZusammen(p.lokal, eigeneSicherung), ersetzen: false, zuruecklegen: null }
  // Anderer Account: der Stand hier gehoert dem alten, er wird fuer ihn zurueckgelegt
  const zuruecklegen = kampagneLeer(p.lokal) ? null : kampagneZusammen(p.sicherung[p.altUid] ?? LEER, p.lokal)
  if (p.cloud && !kampagneLeer(p.cloud)) return { hoch: eigeneSicherung, ersetzen: true, zuruecklegen }
  return { hoch: kampagneZusammen(p.lokal, eigeneSicherung), ersetzen: false, zuruecklegen }
}


let kLaeuft: Promise<void> | null = null
let kNochmal = false
/** Kampagne mit der Cloud abgleichen (nur dazu, nie weg). Ohne Anmeldung, Netz oder Tabelle passiert nichts */
export function kampagneAbgleichen(): Promise<void> {
  if (kLaeuft) {
    kNochmal = true
    return kLaeuft
  }
  kLaeuft = (async () => {
    for (let runde = 0; runde < 3; runde++) {
      kNochmal = false
      const z = await sitzung().catch(() => null)
      if (!z) return
      const altUid = liesJson<{ uid?: string }>(KONTO_KEY)?.uid ?? null
      const vorher = kampagneSauber(kampagne)
      let cloud: KampagnenStand | null = null
      if (altUid && altUid !== z.id) {
        const { data, error } = await z.sb.from('kampagne').select('geschafft,erreicht').eq('id', z.id).maybeSingle()
        if (error) return
        cloud = data ? kampagneSauber(data) : null
      }
      const sicherung = liesSicherung()
      const plan = kampagnePlan({ altUid, uid: z.id, lokal: vorher, cloud, sicherung })
      // Zuruecklegen, bevor irgendetwas ersetzt wird
      if (plan.zuruecklegen && altUid) schreibJson(SICHERUNG_KEY, { ...sicherung, [altUid]: plan.zuruecklegen })

      const { data, error } = await z.sb.rpc('kampagne_abgleichen', { p_geschafft: plan.hoch.geschafft, p_erreicht: plan.hoch.erreicht })
      if (error) {
        if (!fehltNoch(error)) console.warn('Kampagne: Abgleich fehlgeschlagen', error)
        return
      }
      const ergebnis = kampagneSauber(data)
      // Geraet und Cloud zusammen. Beim Wechsel zu einem Account mit eigener Kampagne gilt seine (die alte ist zurueckgelegt);
      // was waehrend des Abgleichs hier dazukam, gehoert dann zum angemeldeten Account
      const jetzt = kampagneSauber(kampagne)
      const neu = kampagneZusammen(ergebnis, plan.ersetzen ? kampagneSeit(vorher, jetzt) : jetzt)
      if (!kampagneGleich(neu, kampagne)) {
        kampagneUebernehmen(neu)
        hoerer.forEach((f) => f())
      }
      // Die eigene Sicherung ist jetzt in der Cloud
      const s = liesSicherung()
      if (s[z.id]) {
        delete s[z.id]
        schreibJson(SICHERUNG_KEY, s)
      }
      schreibJson(KONTO_KEY, { uid: z.id })
      // Ergebnis hat mehr als die Cloud (dazu waehrend des Abgleichs)? Dann gleich noch einmal
      if (!kNochmal && kampagneGleich(neu, ergebnis)) return
    }
  })().finally(() => (kLaeuft = null))
  return kLaeuft
}

let kTimer = 0
beiKampagne.add(() => {
  clearTimeout(kTimer)
  kTimer = window.setTimeout(() => void kampagneAbgleichen(), 500)
})

/* ---------------- Live: andere Geraete desselben Accounts ----------------
 * Supabase Realtime meldet jede Aenderung an der eigenen Zeile in `spielstand` und `kampagne` (die Leserechte gelten auch
 * dort: man hoert nur sich selbst). Eigene Aenderungen und schon bekannte Staende loesen nichts aus.
 */
type Kanal = { uid: string; sb: Sitzung['sb']; ch: ReturnType<Sitzung['sb']['channel']> }
let kanal: Kanal | null = null
let verbindet = false

async function liveVerbinden() {
  if (verbindet) return
  verbindet = true
  try {
    const z = await sitzung().catch(() => null)
    if (kanal && kanal.uid === z?.id) return
    liveTrennen()
    if (!z) return
    const ch = z.sb
      .channel(`spielstand-${z.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spielstand', filter: `id=eq.${z.id}` }, (p) => {
        const s = (p.new as { stand?: number } | null)?.stand
        if (typeof s === 'number' && s === basisStand()) return
        void abgleichen()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kampagne', filter: `id=eq.${z.id}` }, (p) => {
        if (p.new && kampagneGleich(kampagneSauber(p.new), kampagneSauber(kampagne))) return
        void kampagneAbgleichen()
      })
      .subscribe((status) => {
        // (Wieder) verbunden: was in der Zwischenzeit passiert ist, holen
        if (status === 'SUBSCRIBED') {
          void abgleichen()
          void kampagneAbgleichen()
        }
      })
    kanal = { uid: z.id, sb: z.sb, ch }
  } finally {
    verbindet = false
  }
}

function liveTrennen() {
  if (!kanal) return
  void kanal.sb.removeChannel(kanal.ch)
  kanal = null
}

/** Alles abgleichen (Spielstand und Kampagne) und die Live-Verbindung pruefen */
function allesAbgleichen() {
  void abgleichen()
  void kampagneAbgleichen()
  void liveVerbinden()
}

// Angemeldet (oder wieder verbunden): gleich abgleichen. Abgemeldet: nicht mehr zuhoeren
beiZustand((z) => {
  if (z.ok) allesAbgleichen()
  else if (z.anmelden) liveTrennen()
})

if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof window.addEventListener === 'function') {
  // App verlassen (Home-Taste, App-Wechsel, Tab zu): sofort senden. Zurueck in der App: sofort holen
  document.addEventListener('visibilitychange', () => {
    clearTimeout(timer)
    allesAbgleichen()
  })
  window.addEventListener('pagehide', () => {
    void abgleichen()
    void kampagneAbgleichen()
  })
  window.addEventListener('focus', allesAbgleichen)
  window.addEventListener('online', allesAbgleichen)
  // Sicherheitsnetz, falls ein Live-Signal verloren geht
  window.setInterval(() => {
    if (document.visibilityState === 'visible') allesAbgleichen()
  }, 45_000)
}
