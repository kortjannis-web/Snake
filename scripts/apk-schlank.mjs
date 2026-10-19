// Vor `cap sync android`: die WebM-Videos aus dist entfernen. Android spielt die MP4-Fassung (H.264) ab,
// WebM ist nur fuer Browser ohne H.264 da; spart ~1,8 MB in der APK. Fehlt ein Video, zeichnet der Shop selbst.
import { readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const ordner = join('dist', 'skins')
let n = 0
for (const f of readdirSync(ordner)) {
  if (!f.endsWith('.webm')) continue
  rmSync(join(ordner, f))
  n++
}
console.log(`APK: ${n} WebM-Videos weggelassen (MP4 reicht auf Android)`)
