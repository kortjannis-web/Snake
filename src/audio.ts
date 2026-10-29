/**
 * Alle Toene werden mit der Web Audio API erzeugt (keine Dateien): kurze
 * Effekte fuer Fressen, Gefahren und Menues, dazu eine ruhige Musikschleife.
 * Der AudioContext entsteht erst bei der ersten Beruehrung (Browser-Regel).
 */
type Wave = OscillatorType

class Audio {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private sfx!: GainNode
  private mus!: GainNode
  private noiseBuf: AudioBuffer | null = null
  sfxOn = true
  musicOn = true
  private musicRunning = false
  private duck = false
  private timer = 0
  private nextNote = 0
  private beat = 0

  /** Bei der ersten Beruehrung aufrufen */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.85
      const comp = this.ctx.createDynamicsCompressor()
      comp.threshold.value = -14
      comp.ratio.value = 4
      this.master.connect(comp).connect(this.ctx.destination)
      this.sfx = this.ctx.createGain()
      this.sfx.connect(this.master)
      this.mus = this.ctx.createGain()
      this.mus.gain.value = 0
      this.mus.connect(this.master)
      const len = this.ctx.sampleRate
      this.noiseBuf = this.ctx.createBuffer(1, len, len)
      const d = this.noiseBuf.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    if (this.musicOn && this.wantMusic) this.startMusic()
  }

  /** App im Hintergrund: alles still */
  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend()
  }
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
  }

  private tone(freq: number, dur: number, type: Wave, vol: number, o: { to?: number; delay?: number; attack?: number; filter?: number; vib?: number } = {}) {
    const c = this.ctx
    if (!c || !this.sfxOn) return
    const t = c.currentTime + (o.delay ?? 0)
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur)
    if (o.vib) {
      const lfo = c.createOscillator()
      const lg = c.createGain()
      lfo.frequency.value = o.vib
      lg.gain.value = freq * 0.06
      lfo.connect(lg).connect(osc.frequency)
      lfo.start(t)
      lfo.stop(t + dur + 0.05)
    }
    const a = o.attack ?? 0.005
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + a)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    let node: AudioNode = osc
    if (o.filter) {
      const f = c.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = o.filter
      node = osc.connect(f)
    }
    node.connect(g).connect(this.sfx)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }

  private noise(dur: number, type: BiquadFilterType, freq: number, vol: number, o: { to?: number; delay?: number; attack?: number; q?: number } = {}) {
    const c = this.ctx
    if (!c || !this.sfxOn || !this.noiseBuf) return
    const t = c.currentTime + (o.delay ?? 0)
    const src = c.createBufferSource()
    src.buffer = this.noiseBuf
    const f = c.createBiquadFilter()
    f.type = type
    f.frequency.setValueAtTime(freq, t)
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur)
    f.Q.value = o.q ?? 1
    const g = c.createGain()
    const a = o.attack ?? 0.004
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + a)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f).connect(g).connect(this.sfx)
    src.start(t, Math.random() * 0.5)
    src.stop(t + dur + 0.05)
  }

  /* ---------------- Effekte ---------------- */

  click() {
    this.tone(660, 0.06, 'sine', 0.22)
    this.tone(990, 0.05, 'sine', 0.1, { delay: 0.02 })
  }
  /** Knackiger Biss, innerhalb eines Zehnerblocks steigt der Ton leicht an */
  eat(level: number) {
    const k = 1 + (level % 10) * 0.035
    this.noise(0.07, 'bandpass', 2600, 0.32, { q: 1.4 })
    this.tone(480 * k, 0.1, 'triangle', 0.3, { to: 920 * k })
    this.tone(1400 * k, 0.05, 'sine', 0.08, { delay: 0.04 })
  }
  milestone() {
    ;[523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.2, { delay: i * 0.075 }))
  }
  expand() {
    this.noise(0.9, 'lowpass', 300, 0.22, { to: 4000, attack: 0.25 })
    ;[392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.14, { delay: 0.25 + i * 0.09, attack: 0.02 }))
  }
  unlock_() {
    this.tone(440, 0.14, 'square', 0.09, { filter: 1800 })
    this.tone(659, 0.22, 'square', 0.09, { delay: 0.15, filter: 1800 })
  }
  halt() {
    this.tone(150, 0.13, 'sine', 0.5, { to: 80 })
    this.noise(0.05, 'lowpass', 600, 0.2)
  }
  die(cause: string) {
    if (cause === 'gift') {
      this.tone(340, 0.75, 'sawtooth', 0.14, { to: 110, vib: 9, filter: 1300 })
      this.tone(170, 0.7, 'triangle', 0.18, { to: 70, delay: 0.05 })
      return
    }
    if (cause === 'falle') {
      this.noise(0.05, 'highpass', 3500, 0.55)
      this.tone(1200, 0.08, 'square', 0.16, { to: 300, filter: 4000 })
    }
    if (cause === 'teich') this.noise(0.5, 'lowpass', 1400, 0.3, { to: 200, attack: 0.02 })
    this.tone(420, 0.6, 'sawtooth', 0.16, { to: 90, filter: 1200, delay: 0.05 })
    this.noise(0.3, 'lowpass', 900, 0.25)
  }
  trap() {
    this.tone(1900, 0.05, 'square', 0.08, { filter: 6000 })
    this.tone(2700, 0.05, 'square', 0.06, { delay: 0.04, filter: 6000 })
    this.noise(0.06, 'highpass', 5000, 0.2)
    this.tone(900, 0.09, 'triangle', 0.1, { delay: 0.09 })
  }
  cloud() {
    this.noise(0.9, 'bandpass', 1500, 0.2, { to: 500, attack: 0.25, q: 0.8 })
    this.tone(110, 0.8, 'sine', 0.12, { to: 90, attack: 0.2 })
  }
  cloudGrow() {
    this.noise(0.45, 'bandpass', 1100, 0.14, { to: 600, attack: 0.1, q: 0.8 })
  }
  /** Frosch taucht auf: kurzes Quaken */
  frog() {
    ;[0, 0.16].forEach((d) => {
      this.tone(140, 0.12, 'sawtooth', 0.12, { to: 110, delay: d, filter: 900, vib: 30 })
      this.tone(280, 0.1, 'square', 0.04, { delay: d, filter: 1200 })
    })
  }
  /** Sprung: leises Ploppen */
  hop() {
    this.tone(320, 0.08, 'sine', 0.07, { to: 620 })
    this.noise(0.04, 'lowpass', 900, 0.05, { delay: 0.3 })
  }
  /** Jaegerturm: dumpfer Steinschlag und ein Surren des Scheinwerfers */
  tower() {
    this.tone(90, 0.35, 'sine', 0.32, { to: 50 })
    this.noise(0.2, 'lowpass', 600, 0.25)
    this.tone(880, 0.4, 'triangle', 0.05, { to: 1320, delay: 0.25, attack: 0.1 })
  }
  stolen() {
    this.tone(720, 0.22, 'triangle', 0.2, { to: 330 })
    this.tone(540, 0.18, 'triangle', 0.12, { to: 260, delay: 0.1 })
  }
  pond() {
    this.tone(280, 0.14, 'sine', 0.18, { to: 680 })
    this.tone(420, 0.1, 'sine', 0.1, { to: 900, delay: 0.08 })
  }
  record() {
    ;[523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.18, { delay: i * 0.1 }))
  }
  /** Rueckschlag: absteigende Toene */
  setback() {
    ;[784, 659, 523, 392].forEach((f, i) => this.tone(f, 0.16, 'square', 0.08, { delay: i * 0.07, filter: 2200 }))
    this.tone(220, 0.4, 'sine', 0.2, { to: 110, delay: 0.25 })
  }
  /** Baum faellt: dumpfer Schlag mit Rascheln */
  tree() {
    this.noise(0.35, 'bandpass', 2400, 0.16, { to: 900, attack: 0.05 })
    this.tone(110, 0.3, 'sine', 0.35, { to: 55, delay: 0.18 })
    this.noise(0.12, 'lowpass', 500, 0.3, { delay: 0.18 })
  }
  /** Haus steht: zwei Holzschlaege */
  house() {
    ;[0, 0.14].forEach((d) => {
      this.tone(330, 0.08, 'triangle', 0.22, { to: 200, delay: d })
      this.noise(0.05, 'bandpass', 1800, 0.12, { delay: d })
    })
  }
  /** Licht wechselt: leises Klicken */
  light() {
    this.tone(1500, 0.03, 'square', 0.03, { filter: 3000 })
    this.tone(2100, 0.05, 'sine', 0.04, { delay: 0.03 })
  }
  /** Gegner-Schlange taucht auf: kurzes Zischen */
  gegner() {
    this.noise(0.32, 'highpass', 3800, 0.1, { attack: 0.06 })
    this.tone(196, 0.18, 'sawtooth', 0.05, { to: 160, filter: 900, delay: 0.05 })
  }
  /** Ameise bemerkt die Schlange: kurzes Kribbeln */
  ameise() {
    ;[0, 0.05, 0.1].forEach((d) => this.noise(0.03, 'bandpass', 5200, 0.12, { delay: d }))
  }
  /** Ameise zertreten */
  zertreten() {
    this.noise(0.08, 'lowpass', 1400, 0.3)
    this.tone(260, 0.07, 'square', 0.06, { to: 120, filter: 1500 })
  }
  /** Lava bricht aus oder breitet sich aus: dumpfes Blubbern */
  lava(gross = false) {
    this.noise(gross ? 0.6 : 0.25, 'lowpass', gross ? 500 : 380, gross ? 0.35 : 0.16, { to: 120, attack: 0.03 })
    this.tone(gross ? 90 : 120, gross ? 0.5 : 0.18, 'sine', gross ? 0.3 : 0.14, { to: 50 })
  }
  /** Erz gefunden: Gold klingelt, Diamant funkelt hoeher */
  fund(dia = false) {
    const t = dia ? [1568, 2093, 2637, 3136] : [988, 1319, 1568]
    t.forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.12, { delay: i * 0.05 }))
  }
  /** Steingolem (Boss der Wiese): Grollen, Schlaege, Bann und Zerfall */
  golem(was: string) {
    switch (was) {
      case 'erwachen':
        this.noise(1.8, 'lowpass', 140, 0.45, { to: 420, attack: 0.5 })
        this.tone(55, 1.6, 'sawtooth', 0.16, { to: 82, filter: 300, attack: 0.4 })
        this.tone(41, 1.8, 'sine', 0.3, { delay: 0.3, attack: 0.3 })
        break
      case 'warnung':
        this.tone(98, 0.35, 'sawtooth', 0.1, { to: 78, filter: 500, vib: 6 })
        this.noise(0.25, 'lowpass', 500, 0.12, { attack: 0.05 })
        break
      case 'schlag':
      case 'landung':
        this.tone(was === 'landung' ? 70 : 90, 0.55, 'sine', 0.55, { to: 34 })
        this.noise(0.6, 'lowpass', was === 'landung' ? 520 : 420, 0.5, { to: 90 })
        this.noise(0.12, 'bandpass', 1400, 0.18, { q: 0.8 })
        break
      case 'torAuf':
      case 'torZu':
        // Schweres Steintor schleift ueber Stein
        this.noise(was === 'torAuf' ? 0.9 : 0.45, 'lowpass', 260, 0.35, { to: 700, attack: 0.08 })
        this.tone(58, was === 'torAuf' ? 0.8 : 0.4, 'sawtooth', 0.12, { to: 46, filter: 300 })
        if (was === 'torZu') this.tone(80, 0.3, 'sine', 0.35, { to: 40, delay: 0.35 })
        break
      case 'wechsel':
        this.tone(82, 0.9, 'sawtooth', 0.14, { to: 120, vib: 6, filter: 600, attack: 0.1 })
        break
      case 'ansturm':
        for (let i = 0; i < 5; i++) this.tone(64, 0.14, 'sine', 0.3, { to: 40, delay: i * 0.12 })
        this.noise(0.8, 'lowpass', 300, 0.25, { attack: 0.08 })
        break
      case 'aufprall':
        this.noise(0.7, 'lowpass', 1300, 0.55, { to: 120 })
        this.tone(72, 0.6, 'sine', 0.5, { to: 30 })
        this.noise(0.4, 'highpass', 2500, 0.12, { delay: 0.05 })
        break
      case 'stein':
        this.noise(0.3, 'lowpass', 700, 0.32, { to: 140 })
        this.tone(130, 0.2, 'sine', 0.22, { to: 55 })
        break
      case 'sprung':
        this.noise(0.5, 'bandpass', 300, 0.25, { to: 1800, attack: 0.1, q: 0.7 })
        this.tone(60, 0.3, 'sine', 0.3, { to: 40 })
        break
      case 'bann':
        ;[523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.7, 'triangle', 0.12, { delay: i * 0.06, attack: 0.03 }))
        this.noise(0.9, 'highpass', 5000, 0.06, { attack: 0.2 })
        this.tone(110, 0.8, 'sawtooth', 0.1, { to: 70, filter: 400, vib: 9 })
        break
      case 'frei':
        this.tone(140, 0.5, 'sawtooth', 0.14, { to: 70, filter: 600 })
        this.noise(0.4, 'lowpass', 600, 0.2)
        break
      case 'treffer':
        this.noise(0.08, 'highpass', 3000, 0.5)
        this.tone(220, 0.45, 'square', 0.12, { to: 55, filter: 1500 })
        this.noise(0.6, 'lowpass', 900, 0.4, { to: 150, delay: 0.04 })
        ;[1319, 1760].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.1, { delay: 0.1 + i * 0.07 }))
        break
      case 'zorn':
        this.tone(82, 1.3, 'sawtooth', 0.2, { to: 62, vib: 7, filter: 700, attack: 0.15 })
        this.tone(123, 1.1, 'sawtooth', 0.1, { to: 92, vib: 5, filter: 900, attack: 0.15 })
        this.noise(1.2, 'lowpass', 400, 0.3, { attack: 0.2 })
        break
      case 'tot':
        for (let i = 0; i < 7; i++) this.noise(0.35, 'lowpass', 900 - i * 90, 0.35, { delay: i * 0.22, to: 100 })
        this.tone(98, 2.2, 'sawtooth', 0.14, { to: 33, filter: 500, vib: 4, attack: 0.1 })
        ;[523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.12, { delay: 1.6 + i * 0.11 }))
        break
    }
  }
  /** Kleiner Steingolem: Grummeln beim Erscheinen, Knurren beim Entdecken, Ausholen, dumpfer Schlag */
  minigolem(was: string) {
    switch (was) {
      case 'neu':
        this.noise(0.5, 'lowpass', 220, 0.18, { to: 380, attack: 0.15 })
        this.tone(70, 0.5, 'sawtooth', 0.07, { to: 90, filter: 280, attack: 0.1 })
        break
      case 'sieht':
        this.tone(110, 0.3, 'sawtooth', 0.09, { to: 150, filter: 600, vib: 7 })
        break
      case 'laden':
        this.tone(130, 0.4, 'sawtooth', 0.08, { to: 196, filter: 700, attack: 0.1 })
        this.noise(0.3, 'lowpass', 500, 0.08, { attack: 0.1 })
        break
      case 'schlag':
        this.tone(95, 0.35, 'sine', 0.35, { to: 40 })
        this.noise(0.35, 'lowpass', 600, 0.3, { to: 110 })
        break
    }
  }
  /** Kaefigkopf (Dungeon): Stoehnen beim Entdecken, aufsteigendes Summen beim Ausholen, zischender Strahl */
  kaefig(was: string) {
    switch (was) {
      case 'sieht':
        this.tone(98, 0.5, 'sawtooth', 0.07, { to: 82, filter: 500, vib: 5, attack: 0.08 })
        break
      case 'laden':
        this.tone(330, 0.75, 'triangle', 0.06, { to: 880, attack: 0.2 })
        break
      case 'strahl':
        this.noise(0.3, 'bandpass', 2400, 0.14, { to: 900, q: 2 })
        this.tone(660, 0.3, 'square', 0.04, { to: 220, filter: 1800 })
        break
    }
  }
  /** Siegel aufgehoben (hoeher, je weniger fehlen), die grosse Tuer geht auf */
  siegel(rest: number) {
    const f = [784, 659, 523][Math.min(2, rest)] ?? 523
    this.tone(f, 0.35, 'triangle', 0.12)
    this.tone(f * 1.5, 0.45, 'sine', 0.07, { delay: 0.08 })
  }
  tuerAuf() {
    this.noise(1.2, 'lowpass', 300, 0.22, { to: 120, attack: 0.2 })
    this.tone(55, 1.2, 'sawtooth', 0.08, { to: 45, filter: 240, attack: 0.3 })
    ;[392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.09, { delay: 0.6 + i * 0.12 }))
  }
  /** Ent (Boss des Waldes): Knarren, brechende Wurzeln, Dornen, Eicheln, Feuer, Gebruell, Zerfall */
  ent(was: string) {
    switch (was) {
      case 'erwachen':
        // Altes Holz knarrt, tiefes Brummen
        this.tone(62, 2, 'sawtooth', 0.14, { to: 48, filter: 260, vib: 3, attack: 0.5 })
        this.noise(1.6, 'bandpass', 380, 0.2, { to: 160, attack: 0.4, q: 3 })
        break
      case 'warnung':
        this.tone(140, 0.4, 'sawtooth', 0.07, { to: 104, filter: 600, vib: 8 })
        this.noise(0.3, 'bandpass', 900, 0.08, { q: 4 })
        break
      case 'einschlag':
        this.tone(160, 0.2, 'sine', 0.3, { to: 70 })
        this.noise(0.25, 'lowpass', 900, 0.25, { to: 200 })
        break
      case 'sturm':
        this.noise(2.4, 'bandpass', 600, 0.22, { to: 1500, attack: 0.6, q: 0.6 })
        break
      case 'setzling':
        ;[330, 392, 440].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.08, { delay: i * 0.07 }))
        break
      case 'flamme':
        this.noise(0.35, 'bandpass', 1800, 0.14, { to: 900, q: 1.2 })
        this.tone(660, 0.2, 'triangle', 0.08, { to: 880 })
        break
      case 'feuer':
        this.noise(0.8, 'lowpass', 1200, 0.25, { to: 500, attack: 0.05 })
        ;[523, 784].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.1, { delay: 0.05 + i * 0.07 }))
        break
      case 'aus':
        this.noise(0.6, 'highpass', 2500, 0.1, { to: 900 })
        break
      case 'brennt':
        this.noise(1.4, 'lowpass', 1500, 0.35, { to: 400, attack: 0.1 })
        this.tone(98, 1.2, 'sawtooth', 0.14, { to: 140, filter: 700, vib: 9 })
        break
      case 'rueckfeuer':
        this.noise(0.7, 'bandpass', 1200, 0.22, { to: 300, q: 0.9 })
        break
      case 'abtauchen':
      case 'auftauchen':
        this.noise(0.9, 'lowpass', 300, 0.35, { to: was === 'auftauchen' ? 700 : 120 })
        this.tone(55, 0.8, 'sine', 0.3, { to: was === 'auftauchen' ? 82 : 40 })
        break
      case 'zuwachsen':
        this.noise(1.2, 'bandpass', 500, 0.12, { to: 250, attack: 0.3, q: 2 })
        break
      case 'treffer':
        this.noise(0.12, 'highpass', 2500, 0.4)
        this.tone(196, 0.6, 'sawtooth', 0.14, { to: 65, filter: 1200, vib: 6 })
        this.noise(0.7, 'lowpass', 800, 0.35, { to: 150, delay: 0.05 })
        break
      case 'zorn':
        this.tone(73, 1.4, 'sawtooth', 0.2, { to: 58, vib: 6, filter: 650, attack: 0.15 })
        this.tone(110, 1.2, 'sawtooth', 0.1, { to: 82, vib: 4, filter: 800, attack: 0.15 })
        this.noise(1.3, 'bandpass', 420, 0.25, { attack: 0.2, q: 2 })
        break
      case 'tot':
        for (let i = 0; i < 6; i++) this.noise(0.4, 'bandpass', 1400 - i * 150, 0.2, { delay: i * 0.25, q: 1.5 })
        this.tone(82, 2.4, 'sawtooth', 0.12, { to: 30, filter: 450, vib: 3, attack: 0.1 })
        ;[392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.45, 'triangle', 0.12, { delay: 1.7 + i * 0.12 }))
        break
    }
  }
  /** Mini-Ent: Wurf, platzende Blaetterbombe, Griff, losgerissen */
  minient(was: string) {
    switch (was) {
      case 'sieht':
        this.noise(0.3, 'bandpass', 700, 0.08, { to: 1100, q: 2 })
        this.tone(165, 0.3, 'triangle', 0.08, { to: 220, vib: 6 })
        break
      case 'wurf':
        this.noise(0.25, 'bandpass', 900, 0.1, { to: 1800, q: 1 })
        break
      case 'platzt':
        this.noise(0.35, 'bandpass', 1600, 0.2, { to: 600, q: 0.8 })
        this.tone(220, 0.15, 'sine', 0.15, { to: 110 })
        break
      case 'griff':
        this.tone(120, 0.5, 'sawtooth', 0.12, { to: 90, filter: 500, vib: 10 })
        this.noise(0.4, 'bandpass', 500, 0.18, { q: 3 })
        break
      case 'los':
        this.noise(0.2, 'highpass', 1800, 0.16)
        this.tone(440, 0.12, 'triangle', 0.1, { to: 660 })
        break
    }
  }
  /** Kristalle: auftauchen, aufheben, in den Sockel setzen, alle sechs leuchten */
  kristall(was: string, farbe = 0) {
    const k = 1 + farbe * 0.06
    if (was === 'neu') this.tone(1760 * k, 0.25, 'sine', 0.06, { attack: 0.02 })
    else if (was === 'auf') {
      this.tone(988 * k, 0.12, 'triangle', 0.16)
      this.tone(1480 * k, 0.16, 'triangle', 0.12, { delay: 0.06 })
    } else if (was === 'sockel') {
      ;[659 * k, 988 * k, 1319 * k].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.13, { delay: i * 0.05 }))
      this.tone(165 * k, 0.4, 'sine', 0.2, { to: 110 * k })
    } else if (was === 'alle') [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.12, { delay: 0.25 + i * 0.08 }))
  }
  /** Etwas gefressen (Fuettern) */
  happs() {
    this.tone(220, 0.08, 'square', 0.1, { to: 440, filter: 1800 })
    this.noise(0.06, 'lowpass', 1200, 0.25, { delay: 0.04 })
  }
  /** Waende leuchten: neues Gebiet waehlen */
  wahl() {
    ;[523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.12, { delay: i * 0.07 }))
  }
  /** Erde freigelegt */
  freigelegt() {
    this.noise(0.5, 'lowpass', 700, 0.3, { to: 2400, attack: 0.05 })
    this.tone(330, 0.3, 'triangle', 0.14, { to: 660, delay: 0.1 })
  }
  /** Gegner eingekesselt: Plopp und helle Toene */
  besiegt() {
    this.noise(0.12, 'lowpass', 900, 0.3)
    this.tone(330, 0.1, 'triangle', 0.2, { to: 660 })
    ;[880, 1175, 1568].forEach((f, i) => this.tone(f, 0.12, 'square', 0.05, { delay: 0.08 + i * 0.06, filter: 5000 }))
  }
  /** Power-up aufgehoben: aufsteigendes Funkeln */
  power() {
    ;[523, 784, 1047, 1568].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.13, { delay: i * 0.045 }))
  }
  /** Power-up laeuft aus */
  powerEnde() {
    this.tone(880, 0.25, 'triangle', 0.1, { to: 440 })
  }
  /** Schild bricht: Glas */
  schild() {
    this.noise(0.25, 'highpass', 4000, 0.25)
    ;[2093, 2637, 3136].forEach((f, i) => this.tone(f, 0.12, 'sine', 0.07, { delay: i * 0.03 }))
  }
  /** Kauf im Shop */
  kauf() {
    this.tone(1046, 0.08, 'square', 0.07, { filter: 4000 })
    this.tone(1318, 0.08, 'square', 0.07, { delay: 0.07, filter: 4000 })
    this.tone(1568, 0.25, 'triangle', 0.12, { delay: 0.14 })
  }
  /** Zu wenig Aepfel */
  nein() {
    this.tone(220, 0.12, 'square', 0.06, { filter: 900 })
    this.tone(180, 0.18, 'square', 0.06, { delay: 0.1, filter: 900 })
  }
  start() {
    ;[392, 523, 659].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.16, { delay: i * 0.06 }))
  }

  /* ---------------- Musik ----------------
   * a-Moll, Am F C G, 100 bpm: Bass in Halben, gebrochene Akkorde in Achteln.
   * Leise und weich gefiltert. Im Menue und in der Pause gedaempft. */
  private wantMusic = false
  private static PROG = [
    [57, 60, 64, 69], // Am
    [53, 57, 60, 65], // F
    [48, 55, 60, 64], // C
    [55, 59, 62, 67], // G
  ]

  setMusic(on: boolean) {
    this.musicOn = on
    if (on && this.wantMusic) this.startMusic()
    else this.stopMusic()
  }
  /** Musik soll laufen (Spiel/Menue), sofern eingeschaltet */
  music(want: boolean, duck = false) {
    this.wantMusic = want
    this.duck = duck
    if (want && this.musicOn) this.startMusic()
    else this.stopMusic()
    this.applyDuck()
  }
  private applyDuck() {
    if (!this.ctx || !this.musicRunning) return
    const v = this.duck ? 0.35 : 0.75
    this.mus.gain.cancelScheduledValues(this.ctx.currentTime)
    this.mus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.25)
  }
  private startMusic() {
    if (!this.ctx || this.musicRunning) return
    this.musicRunning = true
    this.nextNote = this.ctx.currentTime + 0.1
    this.applyDuck()
    this.timer = window.setInterval(() => this.schedule(), 60)
  }
  private stopMusic() {
    if (!this.musicRunning || !this.ctx) return
    this.musicRunning = false
    clearInterval(this.timer)
    this.mus.gain.cancelScheduledValues(this.ctx.currentTime)
    this.mus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15)
  }
  private schedule() {
    const c = this.ctx
    if (!c) return
    const eighth = 60 / 100 / 2
    while (this.nextNote < c.currentTime + 0.25) {
      const bar = Math.floor(this.beat / 8) % 4
      const chord = Audio.PROG[bar]
      const i = this.beat % 8
      const order = [0, 1, 2, 3, 2, 1, 2, 3]
      const midi = chord[order[i]] + 12
      this.note(midi, eighth * 0.95, 'triangle', i === 0 ? 0.075 : 0.05, 2200)
      if (i === 0 || i === 4) this.note(chord[0] - 12, eighth * 3.8, 'sine', 0.12, 600)
      if (i % 2 === 1) this.hat(0.012)
      this.nextNote += eighth
      this.beat++
    }
  }
  private note(midi: number, dur: number, type: Wave, vol: number, cut: number) {
    const c = this.ctx!
    const t = this.nextNote
    const osc = c.createOscillator()
    const f = c.createBiquadFilter()
    const g = c.createGain()
    osc.type = type
    osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12)
    f.type = 'lowpass'
    f.frequency.value = cut
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(f).connect(g).connect(this.mus)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }
  private hat(vol: number) {
    const c = this.ctx!
    if (!this.noiseBuf) return
    const t = this.nextNote
    const src = c.createBufferSource()
    src.buffer = this.noiseBuf
    const f = c.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = 7000
    const g = c.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04)
    src.connect(f).connect(g).connect(this.mus)
    src.start(t, Math.random() * 0.5)
    src.stop(t + 0.06)
  }
}

export const audio = new Audio()
