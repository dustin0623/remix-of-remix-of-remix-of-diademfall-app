import { useEffect, useRef } from "react";
import { MAP_HEIGHT, MAP_WIDTH, TILE_SIZE } from "@/game/data/TileTypes";
import { GAME_CONFIG } from "@/game/engine/config/GameConfig";
import { useSettingsStore } from "@/features/stores/settings.store";

/** Mounts the Phaser world. Phaser is imported dynamically so it never runs during SSR. */
export function PhaserGame({ className, muted = false, decorative = false, theme = "classic" }: { className?: string; muted?: boolean; decorative?: boolean; theme?: "classic" | "crystal" }) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let destroyed = false;
    let game: import("phaser").Game | null = null;
    // Apply the master channel to every Phaser sound, including sounds already playing.
    const applyAudio = () => {
      if (!game?.sound || muted) return;
      const { soundOn, masterVolume } = useSettingsStore.getState();
      game.sound.setMute(!soundOn);
      game.sound.setVolume(masterVolume / 100);
    };
    const unsubscribeAudio = useSettingsStore.subscribe(applyAudio);
    (async () => {
      const Phaser = await import("phaser");
      const { BootScene } = await import("@/game/scenes/BootScene");
      const { TreasureScene } = await import("@/game/scenes/TreasureScene");
      if (destroyed || !hostRef.current) return;
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: hostRef.current,
        width: MAP_WIDTH * TILE_SIZE,
        height: MAP_HEIGHT * TILE_SIZE,
        backgroundColor: GAME_CONFIG.RENDER.BG_COLOR,
        scene: [BootScene, TreasureScene],
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        render: { pixelArt: true, antialias: false },
        audio: { noAudio: muted },
        banner: false,
        callbacks: {
          preBoot: (g) => { g.registry.set("decorative", decorative); g.registry.set("mapTheme", theme); },
          postBoot: () => applyAudio(),
        },
      });
      applyAudio();
    })();
    return () => {
      destroyed = true;
      unsubscribeAudio();
      game?.destroy(true);
    };
  }, [muted, decorative, theme]);

  return <div ref={hostRef} className={className} style={{ aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}` }} />;
}
