import { beforeAll, describe, expect, it, vi } from 'vitest'

/* Ablauf des Kampagnen-Abgleichs mit einer nachgebauten Datenbank (wie supabase/migrations/20261106000000_kampagne.sql:
 * je Account nur dazu, nie weg) und einem Geraet, auf dem nacheinander verschiedene Accounts angemeldet sind. */

type Stand = { geschafft: string[]; erreicht: Record<string, number> }
const db = new Map<string, Stand>()
let angemeldet: string | null = null

function rpcAbgleichen(uid: string, p: { p_geschafft: string[]; p_erreicht: Record<string, number> }): Stand {
  const alt = db.get(uid) ?? { geschafft: [], erreicht: {} }
  const erreicht = { ...alt.erreicht }
  for (const [w, n] of Object.entries(p.p_erreicht)) erreicht[w] = Math.max(erreicht[w] ?? 0, n)
  const neu = { geschafft: [...new Set([...alt.geschafft, ...p.p_geschafft])].sort(), erreicht }
  db.set(uid, neu)
  return neu
}

const sb = {
  rpc: async (name: string, p: { p_geschafft: string[]; p_erreicht: Record<string, number> }) =>
    name === 'kampagne_abgleichen' && angemeldet ? { data: rpcAbgleichen(angemeldet, p), error: null } : { data: null, error: { code: 'PGRST202' } },
  from: () => ({
    select: () => ({
      eq: (_: string, uid: string) => ({ maybeSingle: async () => ({ data: db.get(uid) ?? null, error: null }) }),
    }),
  }),
}

vi.mock('../src/online', () => ({
  sitzung: async () => (angemeldet ? { sb, id: angemeldet } : null),
  beiZustand: () => undefined,
}))

const speicher = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => speicher.get(k) ?? null,
  setItem: (k: string, v: string) => void speicher.set(k, v),
  removeItem: (k: string) => void speicher.delete(k),
})
vi.stubGlobal('window', { setTimeout: () => 0 })

let K: typeof import('../src/kampagne')
let C: typeof import('../src/cloud')
const mission = (nr: number) => ({ id: `wiese-${nr}`, nr, lohn: 1 }) as unknown as import('../src/game/missionen').MissionDef
const hier = () => [...K.kampagne.geschafft].sort()

beforeAll(async () => {
  // Stand vor dem Update: Gisch hat auf diesem Geraet 3 Missionen geschafft, nur lokal gespeichert
  speicher.set('snake-kampagne', JSON.stringify({ geschafft: ['wiese-1', 'wiese-2', 'wiese-3'], erreicht: { wiese: 3 } }))
  K = await import('../src/kampagne')
  C = await import('../src/cloud')
})

describe('Kampagne: Abgleich ueber Account und Geraete', () => {
  it('ohne Anmeldung passiert nichts, der Stand bleibt auf dem Geraet', async () => {
    await C.kampagneAbgleichen()
    expect(hier()).toEqual(['wiese-1', 'wiese-2', 'wiese-3'])
    expect(db.size).toBe(0)
  })

  it('erster Abgleich nach dem Update: der Stand vom Geraet landet beim Account', async () => {
    angemeldet = 'gisch'
    await C.kampagneAbgleichen()
    expect(db.get('gisch')!.geschafft).toEqual(['wiese-1', 'wiese-2', 'wiese-3'])
    expect(db.get('gisch')!.erreicht).toEqual({ wiese: 3 })
  })

  it('neue Mission kommt dazu', async () => {
    K.missionGeschafft(mission(4))
    K.setzeErreicht('wiese', 4)
    await C.kampagneAbgleichen()
    expect(db.get('gisch')!.geschafft).toContain('wiese-4')
    expect(db.get('gisch')!.erreicht.wiese).toBe(4)
  })

  it('zweiter Spieler auf demselben Geraet mit eigener Kampagne: seine gilt, Gischs Stand bleibt sicher', async () => {
    db.set('anna', { geschafft: ['wiese-1'], erreicht: { wiese: 1 } })
    angemeldet = 'anna'
    await C.kampagneAbgleichen()
    expect(hier()).toEqual(['wiese-1'])
    expect(db.get('anna')!.geschafft).toEqual(['wiese-1'])
    expect(db.get('gisch')!.geschafft).toEqual(['wiese-1', 'wiese-2', 'wiese-3', 'wiese-4'])
  })

  it('Gisch meldet sich wieder an: alles ist wieder da', async () => {
    angemeldet = 'gisch'
    await C.kampagneAbgleichen()
    expect(hier()).toEqual(['wiese-1', 'wiese-2', 'wiese-3', 'wiese-4'])
    expect(K.erreicht('wiese')).toBe(4)
    expect(db.get('anna')!.geschafft).toEqual(['wiese-1'])
  })

  it('Gisch auf einem neuen Geraet (Speicher leer): die Kampagne kommt aus der Cloud', async () => {
    K.kampagneUebernehmen({ geschafft: [], erreicht: {} })
    speicher.clear()
    await C.kampagneAbgleichen()
    expect(hier()).toEqual(['wiese-1', 'wiese-2', 'wiese-3', 'wiese-4'])
    expect(db.get('gisch')!.geschafft).toEqual(['wiese-1', 'wiese-2', 'wiese-3', 'wiese-4'])
  })

  it('Datenbank noch ohne Tabelle: nichts aendert sich', async () => {
    angemeldet = 'gisch'
    const vorher = hier()
    const rpc = sb.rpc
    sb.rpc = async () => ({ data: null, error: { code: 'PGRST202' } })
    await C.kampagneAbgleichen()
    sb.rpc = rpc
    expect(hier()).toEqual(vorher)
  })
})
