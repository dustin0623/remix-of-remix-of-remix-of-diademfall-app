import * as Phaser from "phaser";
import { MAP_HEIGHT, MAP_WIDTH, TILE_SIZE } from "@/game/data/TileTypes";
import { HERO_FACING_ROW, HERO_SPRITES, HERO_SPRITE_COLS, heroSheet, type HeroFacing } from "@/game/data/HeroRarity";
import { resolveHeroSpriteKey } from "@/components/game/HeroSprite";
import { isWall } from "@/lib/game/dungeon/simulation";

export interface HouseHero { id: string; name: string; sprite: string; energy: number; maxEnergy: number }

const SPRITE_KEYS = Object.values(HERO_SPRITES);
/** Leisurely walk in px/sec (about 1.2 tiles per second). */
const WALK_SPEED = TILE_SIZE * 1.2;
const SCALE = 2;
const BAR_W = 22;
const BAR_H = 3;
const DIRS: { dx: number; dy: number; f: HeroFacing }[] = [
  { dx: 1, dy: 0, f: "right" }, { dx: -1, dy: 0, f: "left" }, { dx: 0, dy: 1, f: "down" }, { dx: 0, dy: -1, f: "up" },
];

type Walker = {
  sprite: Phaser.GameObjects.Sprite;
  bar: Phaser.GameObjects.Graphics;
  texture: string;
  gx: number; gy: number; // current target tile
  pauseUntil: number;
  facing: HeroFacing;
  stepsLeft: number;
};

const center = (t: number) => (t + 0.5) * TILE_SIZE;

/** Same board as Play (border walls + pillars), no chests; resting heroes stroll the corridors. */
export class HouseScene extends Phaser.Scene {
  private walkers = new Map<string, Walker>();
  private pending: HouseHero[] | null = null;
  private ready = false;
  private emptyText!: Phaser.GameObjects.Text;

  constructor() { super("HouseScene"); }

  preload() {
    for (const k of SPRITE_KEYS) {
      const sheet = heroSheet(k);
      this.load.spritesheet(`house_${k}`, sheet.url, { frameWidth: sheet.frameW, frameHeight: sheet.frameH });
    }
  }

  create() {
    const g = this.add.graphics().setDepth(0);
    for (let y = 0; y < MAP_HEIGHT; y++)
      for (let x = 0; x < MAP_WIDTH; x++) {
        const px = x * TILE_SIZE, py = y * TILE_SIZE;
        g.fillStyle(0x4ea24e).fillRect(px, py, TILE_SIZE, TILE_SIZE);
        g.lineStyle(1, 0x3d7a3d, 0.4).strokeRect(px, py, TILE_SIZE, TILE_SIZE);
        if (isWall(x, y)) {
          g.fillStyle(0x555555).fillRect(px, py, TILE_SIZE, TILE_SIZE);
          g.lineStyle(2, 0x333333).strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        }
      }
    for (const k of SPRITE_KEYS)
      for (const f of Object.keys(HERO_FACING_ROW) as HeroFacing[]) {
        const key = `house_${k}_${f}`;
        if (this.anims.exists(key)) continue;
        const start = HERO_FACING_ROW[f] * HERO_SPRITE_COLS;
        this.anims.create({ key, frames: this.anims.generateFrameNumbers(`house_${k}`, { start, end: start + HERO_SPRITE_COLS - 1 }), frameRate: 6, repeat: -1 });
      }
    this.emptyText = this.add
      .text((MAP_WIDTH * TILE_SIZE) / 2, (MAP_HEIGHT * TILE_SIZE) / 2, "Empty — assign heroes from the Heroes page.", { fontFamily: "monospace", fontSize: "22px", color: "#ffffff", backgroundColor: "#00000088", padding: { x: 8, y: 4 } })
      .setOrigin(0.5).setDepth(2000);
    this.ready = true;
    if (this.pending) this.setHeroes(this.pending);
  }

  private randomTile() {
    for (;;) {
      const x = 1 + Math.floor(Math.random() * (MAP_WIDTH - 2));
      const y = 1 + Math.floor(Math.random() * (MAP_HEIGHT - 2));
      if (!isWall(x, y)) return { x, y };
    }
  }

  private drawBar(bar: Phaser.GameObjects.Graphics, energy: number, max: number) {
    const ratio = max > 0 ? Math.max(0, Math.min(1, energy / max)) : 0;
    bar.clear();
    bar.fillStyle(0x000000, 0.65).fillRect(-1, -1, BAR_W + 2, BAR_H + 2);
    bar.fillStyle(0x333333).fillRect(0, 0, BAR_W, BAR_H);
    const w = Math.round(BAR_W * ratio);
    if (w > 0) bar.fillStyle(ratio > 0.6 ? 0x44dd44 : ratio > 0.3 ? 0xffcc00 : 0xff4444).fillRect(0, 0, w, BAR_H);
  }

  setHeroes(list: HouseHero[]) {
    if (!this.ready) { this.pending = list; return; }
    const ids = new Set(list.map((h) => h.id));
    for (const [id, w] of this.walkers)
      if (!ids.has(id)) { w.sprite.destroy(); w.bar.destroy(); this.walkers.delete(id); }
    for (const h of list) {
      let w = this.walkers.get(h.id);
      if (!w) {
        const spriteKey = resolveHeroSpriteKey(h.sprite);
        const texture = `house_${spriteKey}`;
        const t = this.randomTile();
        w = {
          sprite: this.add.sprite(center(t.x), center(t.y), texture, 1).setScale((20 * SCALE) / heroSheet(spriteKey).frameH),
          bar: this.add.graphics(),
          texture, gx: t.x, gy: t.y, pauseUntil: 0, facing: "down", stepsLeft: 0,
        };
        this.walkers.set(h.id, w);
      }
      this.drawBar(w.bar, h.energy, h.maxEnergy);
    }
    this.emptyText.setVisible(list.length === 0);
  }

  /** Picks the next adjacent open tile, preferring to keep going straight. */
  private nextStep(w: Walker, time: number) {
    if (w.stepsLeft <= 0) {
      w.stepsLeft = 2 + Math.floor(Math.random() * 6);
      if (Math.random() < 0.5) {
        w.pauseUntil = time + 1500 + Math.random() * 3500;
        w.sprite.anims.stop();
        w.sprite.setFrame(HERO_FACING_ROW[w.facing] * HERO_SPRITE_COLS + 1);
        return;
      }
    }
    const open = DIRS.filter((d) => !isWall(w.gx + d.dx, w.gy + d.dy));
    const straight = open.find((d) => d.f === w.facing);
    const d = straight && Math.random() < 0.7 ? straight : open[Math.floor(Math.random() * open.length)];
    if (!d) return;
    w.gx += d.dx; w.gy += d.dy; w.stepsLeft--;
    if (d.f !== w.facing || !w.sprite.anims.isPlaying) { w.facing = d.f; w.sprite.play(`${w.texture}_${d.f}`, true); }
  }

  override update(time: number, delta: number) {
    const dt = Math.min(0.1, delta / 1000);
    for (const w of this.walkers.values()) {
      const s = w.sprite;
      if (time >= w.pauseUntil) {
        const tx = center(w.gx), ty = center(w.gy);
        const dx = tx - s.x, dy = ty - s.y;
        const dist = Math.hypot(dx, dy);
        const step = WALK_SPEED * dt;
        if (dist <= step) { s.setPosition(tx, ty); this.nextStep(w, time); }
        else { s.x += (dx / dist) * step; s.y += (dy / dist) * step; }
      }
      const depth = 10 + s.y;
      s.setDepth(depth);
      w.bar.setPosition(Math.round(s.x - BAR_W / 2), Math.round(s.y - 20)).setDepth(depth + 1);
    }
  }
}
