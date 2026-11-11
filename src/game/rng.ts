/** Deterministic counter-based RNG: same seed + sequence => same replay. */
export function hash(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= 0x9e3779b9;
  }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

export class Rng {
  private i = 0;
  constructor(public seed: number) {}
  next(purpose: string): number { return hash(this.seed, this.i++, purpose); }
  int(max: number, purpose: string) { return Math.floor(this.next(purpose) * max); }
}
