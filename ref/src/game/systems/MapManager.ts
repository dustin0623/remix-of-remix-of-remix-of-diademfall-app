import * as Phaser from "phaser";
import { MAP_HEIGHT, MAP_WIDTH, TILE_SIZE } from "@/game/data/TileTypes";
import { CHEST_STATS, CHEST_TEXTURE, ChestRarity } from "@/game/data/ChestRarity";
import type { GameNode, GameState } from "@/lib/game/dungeon/types";
import { isWall } from "@/lib/game/dungeon/simulation";

const PALETTES: [number, number, number, number][] = [
  [0x4ea24e, 0x3d7a3d, 0x555555, 0x333333],
  [0xc9a26b, 0x8a6a3f, 0x7a4a2a, 0x4a2a15],
  [0x6b7a99, 0x3f4a63, 0x2f3a52, 0x1a1f2e],
  [0x5a3a2e, 0x3e1f18, 0x8a2a2a, 0x4a1010],
  [0x3a2a4e, 0x1f1530, 0x5e3a8a, 0x2a1548],
];

/** Presentation only: node HP and destruction always come from the game state. */
export class MapManager {
  private mapId = "";
  private ground: Phaser.GameObjects.Graphics;
  private health: Phaser.GameObjects.Graphics;
  private sprites = new Map<string, Phaser.GameObjects.Image>();
  private nodes: Record<string, GameNode> = {};
  constructor(private scene: Phaser.Scene) {
    this.ground = scene.add.graphics().setDepth(0);
    this.health = scene.add.graphics().setDepth(5);
  }
  apply(state: GameState): void {
    if (state.mapId !== this.mapId) {
      this.mapId = state.mapId;
      this.sprites.forEach((sprite) => sprite.destroy());
      this.sprites.clear();
      this.nodes = {};
      const crystalTheme = this.scene.registry.get("mapTheme") === "crystal";
      const [fill, stroke, wall, wallStroke] = crystalTheme
        ? [0xe3b875, 0xc99c5e, 0x986032, 0xa46c3a] as const
        : PALETTES[(state.stage - 1) % PALETTES.length]!;
      this.ground.clear();
      for (let y = 0; y < MAP_HEIGHT; y++)
        for (let x = 0; x < MAP_WIDTH; x++) {
          const px = x * TILE_SIZE,
            py = y * TILE_SIZE;
          this.ground.fillStyle(fill).fillRect(px, py, TILE_SIZE, TILE_SIZE);
          this.ground.lineStyle(1, stroke, 0.4).strokeRect(px, py, TILE_SIZE, TILE_SIZE);
          if (isWall(x, y)) {
            this.ground.fillStyle(wall).fillRect(px, py, TILE_SIZE, TILE_SIZE);
            this.ground
              .lineStyle(2, wallStroke)
              .strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
          }
        }
    }
    for (const [key, sprite] of this.sprites)
      if (!state.nodes[key] || state.nodes[key].destroyed) {
        sprite.destroy();
        this.sprites.delete(key);
      }
    for (const [key, node] of Object.entries(state.nodes)) {
      if (node.destroyed || this.sprites.has(key)) continue;
      const texture = node.kind === "chest" ? CHEST_TEXTURE[node.rarity as ChestRarity] : "bush";
      const sprite = this.scene.add
        .image((node.x + 0.5) * TILE_SIZE, (node.y + 0.5) * TILE_SIZE, texture)
        .setDepth(4)
        .setDisplaySize(TILE_SIZE - 4, TILE_SIZE - 4);
      if (node.kind === "chest") {
        sprite.setInteractive({ useHandCursor: true });
        sprite.on("pointerover", () => {
          this.hovered = key;
          this.renderTooltip();
        });
        sprite.on("pointerout", () => {
          if (this.hovered === key) this.hovered = null;
          this.renderTooltip();
        });
      }
      this.sprites.set(key, sprite);
    }
    this.nodes = state.nodes;
    if (this.hovered && !this.sprites.has(this.hovered)) this.hovered = null;
    this.renderTooltip();
    this.health.clear();
    for (const node of Object.values(this.nodes)) {
      if (node.destroyed || node.hp >= node.maxHp || node.maxHp <= 1) continue;
      const width = TILE_SIZE - 6;
      this.health
        .fillStyle(0x000000, 0.6)
        .fillRect(node.x * TILE_SIZE + 3, node.y * TILE_SIZE + 2, width, 4);
      this.health
        .fillStyle(0x22dd55)
        .fillRect(
          node.x * TILE_SIZE + 3,
          node.y * TILE_SIZE + 2,
          (width * node.hp) / node.maxHp,
          4,
        );
    }
  }

  private hovered: string | null = null;
  private tipBg: Phaser.GameObjects.Graphics | null = null;
  private tipText: Phaser.GameObjects.Text | null = null;

  private renderTooltip(): void {
    const node = this.hovered ? this.nodes[this.hovered] : undefined;
    if (!node || node.destroyed) {
      this.tipBg?.setVisible(false);
      this.tipText?.setVisible(false);
      return;
    }
    if (!this.tipBg) this.tipBg = this.scene.add.graphics().setDepth(100);
    if (!this.tipText)
      this.tipText = this.scene.add
        .text(0, 0, "", {
          fontFamily: "monospace",
          fontSize: "16px",
          fontStyle: "bold",
          color: "#ffffff",
          align: "center",
        })
        .setOrigin(0.5, 1)
        .setDepth(101);
    const tint = CHEST_STATS[node.rarity as ChestRarity]?.tint ?? 0xffffff;
    this.tipText.setText(`${Math.ceil(node.hp)} / ${node.maxHp}`);
    const cx = (node.x + 0.5) * TILE_SIZE;
    const bottom = Math.max(node.y * TILE_SIZE - 4, this.tipText.height + 8);
    this.tipText.setPosition(cx, bottom - 4).setVisible(true);
    const w = this.tipText.width + 12, h = this.tipText.height + 8;
    this.tipBg
      .clear()
      .fillStyle(0x000000, 0.85)
      .fillRoundedRect(cx - w / 2, bottom - h, w, h, 4)
      .lineStyle(1, tint, 1)
      .strokeRoundedRect(cx - w / 2, bottom - h, w, h, 4)
      .setVisible(true);
  }
}
