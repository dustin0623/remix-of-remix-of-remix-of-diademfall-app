import { useEffect, useRef } from "react";
import { MAP_HEIGHT, MAP_WIDTH, TILE_SIZE } from "@/game/data/TileTypes";
import type { HouseHero, HouseScene } from "@/game/scenes/HouseScene";

/** Phaser house board; Phaser is imported dynamically so it never runs during SSR. */
export function HousePhaserGame({ heroes, className }: { heroes: HouseHero[]; className?: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<HouseScene | null>(null);
  const heroesRef = useRef(heroes);
  heroesRef.current = heroes;

  useEffect(() => {
    let destroyed = false;
    let game: import("phaser").Game | null = null;
    (async () => {
      const Phaser = await import("phaser");
      const { HouseScene } = await import("@/game/scenes/HouseScene");
      if (destroyed || !hostRef.current) return;
      const scene = new HouseScene();
      sceneRef.current = scene;
      scene.setHeroes(heroesRef.current);
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: hostRef.current,
        width: MAP_WIDTH * TILE_SIZE,
        height: MAP_HEIGHT * TILE_SIZE,
        backgroundColor: "#1a1a1a",
        scene: [scene],
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        render: { pixelArt: true, antialias: false },
        audio: { noAudio: true },
        banner: false,
      });
    })();
    return () => { destroyed = true; sceneRef.current = null; game?.destroy(true); };
  }, []);

  useEffect(() => { sceneRef.current?.setHeroes(heroes); }, [heroes]);

  return <div ref={hostRef} className={className} style={{ aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}` }} />;
}
