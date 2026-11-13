import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Original synthesized battle sounds. Run with node scripts/generate-battle-sfx.mjs.
const destination = fileURLToPath(new URL("../public/assets/audio/sfx/", import.meta.url));
const sampleRate = 44100;
const tau = Math.PI * 2;
const sounds = [
  { id: "melee-swing", duration: 0.22, peak: 0.62 },
  { id: "melee-impact", duration: 0.29, peak: 0.74 },
  { id: "ranged-shot", duration: 0.23, peak: 0.64 },
  { id: "ranged-impact", duration: 0.22, peak: 0.68 },
  { id: "magic-cast", duration: 0.38, peak: 0.64 },
  { id: "magic-impact", duration: 0.42, peak: 0.72 },
  { id: "miss", duration: 0.2, peak: 0.48 },
  { id: "defeat", duration: 0.52, peak: 0.62 },
];

mkdirSync(destination, { recursive: true });
for (let index = 0; index < sounds.length; index++) {
  const sound = sounds[index];
  const samples = new Float64Array(Math.ceil(sound.duration * sampleRate));
  let seed = 59137 + index * 997;
  let lowNoise = 0;
  const phases = [0, 0, 0];
  const tone = (voice, frequency) => {
    phases[voice] += (tau * frequency) / sampleRate;
    return Math.sin(phases[voice]);
  };
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    const progress = t / sound.duration;
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const noise = (seed >>> 0) / 2147483648 - 1;
    lowNoise += 0.12 * (noise - lowNoise);
    const highNoise = noise - lowNoise;
    let value = 0;
    switch (sound.id) {
      case "melee-swing":
        value =
          (lowNoise * 1.8 + highNoise * 0.12 + tone(0, 170 + 600 * progress) * 0.1) *
          Math.sin(Math.PI * progress) ** 1.6;
        break;
      case "melee-impact":
        value =
          (tone(0, 135 * Math.exp(-12 * t)) * 0.6 + lowNoise * 0.8) * Math.exp(-20 * t) +
          (tone(1, 1460) + tone(2, 2183) * 0.5 + highNoise * 0.3) * Math.exp(-27 * t) * 0.24;
        break;
      case "ranged-shot":
        value =
          tone(0, 360 * Math.exp(-7 * t)) * Math.exp(-25 * t) * 0.6 +
          (highNoise * 0.2 + lowNoise * 0.6) * Math.exp(-13 * t);
        break;
      case "ranged-impact":
        value =
          (tone(0, 245 * Math.exp(-9 * t)) * 0.65 + tone(1, 720) * 0.2 + highNoise * 0.25) *
          Math.exp(-27 * t);
        break;
      case "magic-cast":
        value =
          (tone(0, 420 + 920 * progress) * 0.45 +
            tone(1, 630 + 1160 * progress) * 0.22 +
            tone(2, 842 + 1400 * progress) * 0.1 +
            lowNoise * 0.2) *
          Math.sin(Math.PI * progress) ** 1.1;
        break;
      case "magic-impact":
        value =
          (tone(0, 110 + 110 * Math.exp(-20 * t)) * 0.55 + lowNoise * 0.7) * Math.exp(-19 * t) +
          (tone(1, 1046.5) * 0.16 + tone(2, 1568) * 0.1) * Math.exp(-10 * t);
        break;
      case "miss":
        value =
          (lowNoise * 1.3 + highNoise * 0.16 + tone(0, 740 - 480 * progress) * 0.05) *
          Math.sin(Math.PI * progress) ** 1.8;
        break;
      case "defeat":
        value =
          (tone(0, 125 - 80 * progress) * 0.5 + lowNoise * 0.6) * Math.exp(-11 * t) +
          tone(1, 390 - 220 * progress) * 0.13 * Math.exp(-16 * t);
        break;
    }
    const fade = Math.min(1, t / 0.003, (sound.duration - t) / 0.012);
    samples[i] = value * Math.max(0, fade);
  }
  const peak = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, i) =>
    wav.writeInt16LE(Math.round((sample / peak) * sound.peak * 32767), 44 + i * 2),
  );
  writeFileSync(`${destination}/${sound.id}.wav`, wav);
}
writeFileSync(
  `${destination}/manifest.json`,
  JSON.stringify(
    {
      source: "Original procedural synthesis for Diademfall",
      generator: "scripts/generate-battle-sfx.mjs",
      sampleRate,
      channels: 1,
      bitsPerSample: 16,
      sounds,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Exported ${sounds.length} original WAV sound effects to public/assets/audio/sfx.`);
