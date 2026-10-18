import { describe, expect, it } from 'vitest'
import { erkenne, keinSafari } from '../src/install'

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0 Mobile/15E148 Safari/604.1'
const IPHONE_INSTA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0'
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36'
const WINDOWS_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'

describe('Geräteerkennung für die Installationsanleitung', () => {
  it('erkennt iPhone und Android', () => {
    expect(erkenne(IPHONE_SAFARI)).toBe('ios')
    expect(erkenne(ANDROID_CHROME)).toBe('android')
  })
  it('erkennt das iPad, das sich als Mac meldet', () => {
    expect(erkenne(MAC_SAFARI, 'MacIntel', 5)).toBe('ios')
  })
  it('lässt Computer in Ruhe (keine Installationspflicht)', () => {
    expect(erkenne(WINDOWS_CHROME, 'Win32', 0)).toBeNull()
    expect(erkenne(MAC_SAFARI, 'MacIntel', 0)).toBeNull()
  })
  it('merkt, wenn auf dem iPhone nicht Safari läuft', () => {
    expect(keinSafari(IPHONE_SAFARI)).toBe(false)
    expect(keinSafari(IPHONE_CHROME)).toBe(true)
    expect(keinSafari(IPHONE_INSTA)).toBe(true)
  })
})
