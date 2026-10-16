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
