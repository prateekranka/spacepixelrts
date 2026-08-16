/** P34 — short command cues. Unlocks on first pointer. */

export class Sfx {
  private ctx: AudioContext | null = null;
  resume(): void {
    this.ctx ??= new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }
  select(): void {
    this.tone(720, 0.045, 'square', 0.03);
  }
  move(): void {
    this.tone(420, 0.07, 'triangle', 0.04);
  }
  attack(): void {
    this.tone(180, 0.09, 'sawtooth', 0.05);
  }
  build(): void {
    this.tone(520, 0.12, 'square', 0.035);
  }
  private tone(freq: number, dur: number, type: OscillatorType, gain: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur);
  }
}
