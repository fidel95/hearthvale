// Sound effects and optional music, all made in the browser with the Web
// Audio API: short tones with an envelope, no sound files. That keeps them
// original (nothing to license), tiny, and working offline.
//
// Browsers only allow audio after the player has interacted with the page,
// so the audio context starts on the first tap or key press.

export type SoundName = 'click' | 'place' | 'collect' | 'harvest' | 'levelup' | 'error' | 'ship'

// Each sound as a list of notes: [frequency in Hz, start in seconds, length, wave].
type Note = [number, number, number, OscillatorType?]
const SOUNDS: Record<SoundName, Note[]> = {
  click: [[880, 0, 0.04, 'triangle']],
  place: [
    [196, 0, 0.12, 'square'],
    [392, 0.06, 0.18, 'triangle'],
  ],
  collect: [
    [1318, 0, 0.08, 'triangle'],
    [1760, 0.07, 0.14, 'triangle'],
  ],
  harvest: [
    [523, 0, 0.1, 'triangle'],
    [659, 0.08, 0.1, 'triangle'],
    [784, 0.16, 0.16, 'triangle'],
  ],
  levelup: [
    [523, 0, 0.14, 'triangle'],
    [659, 0.12, 0.14, 'triangle'],
    [784, 0.24, 0.14, 'triangle'],
    [1046, 0.36, 0.4, 'triangle'],
  ],
  error: [
    [180, 0, 0.12, 'sawtooth'],
    [140, 0.1, 0.16, 'sawtooth'],
  ],
  ship: [
    [110, 0, 0.6, 'sawtooth'],
    [147, 0, 0.6, 'sine'],
  ],
}

// A calm pentatonic scale for the background music.
const SCALE = [262, 294, 330, 392, 440, 523, 587, 659]

export class Sound {
  volume = 0.6 // 0 to 1; 0 is muted
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private musicTimer: number | undefined

  constructor() {
    // Start (or resume) the audio context on the first interaction.
    const unlock = () => {
      if (!this.context) {
        this.context = new AudioContext()
        this.master = this.context.createGain()
        this.master.connect(this.context.destination)
        this.setVolume(this.volume)
      }
      void this.context.resume()
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    // Quiet while the tab is hidden.
    document.addEventListener('visibilitychange', () => {
      if (!this.context) return
      if (document.visibilityState === 'hidden') void this.context.suspend()
      else void this.context.resume()
    })
  }

  setVolume(volume: number) {
    this.volume = volume
    if (this.master) this.master.gain.value = volume * 0.25 // keep effects gentle
  }

  play(name: SoundName) {
    const ctx = this.context
    if (!ctx || !this.master || this.volume === 0 || ctx.state !== 'running') return
    const now = ctx.currentTime
    for (const [freq, start, length, wave = 'sine'] of SOUNDS[name]) this.tone(freq, now + start, length, wave, 1)
  }

  // Music: a soft note from the scale every so often, never the same tune twice.
  setMusic(on: boolean) {
    window.clearInterval(this.musicTimer)
    if (!on) return
    this.musicTimer = window.setInterval(() => {
      const ctx = this.context
      if (!ctx || ctx.state !== 'running' || this.volume === 0) return
      const note = SCALE[Math.floor(Math.random() * SCALE.length)]
      this.tone(note / 2, ctx.currentTime, 1.6, 'sine', 0.35)
      if (Math.random() < 0.4) this.tone(note, ctx.currentTime + 0.4, 1.2, 'sine', 0.2)
    }, 900)
  }

  // Rain: soft noise, filtered so it hisses gently, at a level from 0 (none) to 1.
  private rain: GainNode | null = null
  setRain(level: number) {
    const ctx = this.context
    if (!ctx || !this.master) return
    if (!this.rain) {
      const seconds = 2
      const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      const noise = ctx.createBufferSource()
      noise.buffer = buffer
      noise.loop = true
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 1400
      filter.Q.value = 0.6
      this.rain = ctx.createGain()
      this.rain.gain.value = 0
      noise.connect(filter).connect(this.rain).connect(this.master)
      noise.start()
    }
    this.rain.gain.setTargetAtTime(level * 0.35, ctx.currentTime, 0.5)
  }

  // One note: a quick rise, then a fade (an "envelope"), so it doesn't click.
  private tone(freq: number, at: number, length: number, wave: OscillatorType, loudness: number) {
    const ctx = this.context!
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = wave
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(0.6 * loudness, at + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, at + length)
    osc.connect(gain).connect(this.master!)
    osc.start(at)
    osc.stop(at + length + 0.05)
  }
}
