export const BATTLE_SFX = {
  "melee-swing": "/assets/audio/sfx/melee-swing.wav",
  "melee-impact": "/assets/audio/sfx/melee-impact.wav",
  "ranged-shot": "/assets/audio/sfx/ranged-shot.wav",
  "ranged-impact": "/assets/audio/sfx/ranged-impact.wav",
  "magic-cast": "/assets/audio/sfx/magic-cast.wav",
  "magic-impact": "/assets/audio/sfx/magic-impact.wav",
  miss: "/assets/audio/sfx/miss.wav",
  defeat: "/assets/audio/sfx/defeat.wav",
} as const;
export type BattleSfxId = keyof typeof BATTLE_SFX;

/** One context per viewer lets pause freeze every active sound with the animation. */
export class BattleSoundPlayer {
  private readonly gain: GainNode;
  private readonly buffers = new Map<BattleSfxId, AudioBuffer>();
  private readonly voices = new Set<AudioBufferSourceNode>();
  private readonly abort = new AbortController();
  private loading: Promise<void> | undefined;
  private disposed = false;
  private enabled = true;
  private speed = 1;

  constructor(private readonly context: AudioContext) {
    this.gain = context.createGain();
    this.gain.gain.value = 0.5;
    this.gain.connect(context.destination);
  }

  load() {
    this.loading ??= Promise.allSettled(
      Object.entries(BATTLE_SFX).map(async ([id, path]) => {
        const response = await fetch(path, { signal: this.abort.signal });
        if (!response.ok) return;
        const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
        if (!this.disposed) this.buffers.set(id as BattleSfxId, buffer);
      }),
    ).then(() => undefined);
    return this.loading;
  }

  setVolume(volume: number, muted: boolean) {
    if (this.disposed) return;
    this.enabled = !muted && volume > 0;
    this.gain.gain.setTargetAtTime(muted ? 0 : volume, this.context.currentTime, 0.01);
  }

  setTransport(playing: boolean, speed: number) {
    if (this.disposed) return;
    this.speed = speed;
    for (const voice of this.voices)
      voice.playbackRate.setValueAtTime(speed, this.context.currentTime);
    const transition = playing ? this.context.resume() : this.context.suspend();
    void transition.catch(() => {});
  }

  play(id: BattleSfxId) {
    const buffer = this.buffers.get(id);
    // Skip an unavailable clip instead of replaying it late after loading.
    if (!buffer || !this.enabled || this.disposed) return;
    const voice = this.context.createBufferSource();
    voice.buffer = buffer;
    voice.playbackRate.value = this.speed;
    voice.connect(this.gain);
    voice.onended = () => {
      this.voices.delete(voice);
      voice.disconnect();
    };
    this.voices.add(voice);
    voice.start();
  }

  stop() {
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
  }

  dispose() {
    this.disposed = true;
    this.abort.abort();
    this.stop();
    void this.context.close().catch(() => {});
  }
}
