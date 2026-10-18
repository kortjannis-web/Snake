/**
 * Die Android-App kann sich nicht selbst ersetzen. Sie fragt deshalb beim Start die
 * version.json der Web-App ab (liegt bei jedem Build auf GitHub Pages) und weist auf eine
 * neuere APK hin. Die Web-App selbst aktualisiert sich ueber den Service Worker.
 */
/** Adresse der Web-App (endet mit /) */
const roh = (import.meta.env.VITE_PAGES_URL as string | undefined)?.trim() || 'https://kortjannis-web.github.io/Snake/'
export const WEB_URL = roh.endsWith('/') ? roh : `${roh}/`
const BASIS = WEB_URL
export const APK_URL = 'https://github.com/kortjannis-web/Snake/releases/latest/download/snake-endlos.apk'

/** Neue Versionsnummer, wenn die Web-App aktueller ist als diese App, sonst null */
export async function neueVersion(): Promise<string | null> {
  try {
    const r = await fetch(`${BASIS}version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return null
    const v = (await r.json()) as { version?: string; build?: number }
    return typeof v.build === 'number' && v.build > __BUILD_TIME__ ? String(v.version ?? '') : null
  } catch {
    return null
  }
}
