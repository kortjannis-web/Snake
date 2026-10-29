/**
 * Die Android-App kann sich nicht selbst ersetzen. Sie fragt deshalb beim Start die
 * version.json der Web-App ab (liegt bei jedem Build auf GitHub Pages) und weist auf eine
 * neuere APK hin. Die Web-App aktualisiert sich ueber den Service Worker und prueft mit
 * derselben version.json, ob er haengt (dann laedt sie hart neu).
 */
/** Adresse der Web-App (endet mit /) */
const roh = (import.meta.env.VITE_PAGES_URL as string | undefined)?.trim() || 'https://kortjannis-web.github.io/Snake/'
export const WEB_URL = roh.endsWith('/') ? roh : `${roh}/`
const BASIS = WEB_URL
export const APK_URL = 'https://github.com/kortjannis-web/Snake/releases/latest/download/snake-endlos.apk'

/** Die Version online, wenn sie neuer ist als diese App, sonst null. `basis`: woher die version.json kommt */
export async function neueVersion(basis = BASIS): Promise<{ version: string; build: number } | null> {
  try {
    const r = await fetch(`${basis}version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return null
    const v = (await r.json()) as { version?: string; build?: number }
    return typeof v.build === 'number' && v.build > __BUILD_TIME__ ? { version: String(v.version ?? ''), build: v.build } : null
  } catch {
    return null
  }
}
