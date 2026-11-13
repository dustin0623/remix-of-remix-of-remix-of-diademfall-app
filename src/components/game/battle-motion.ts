import type { BattleEvent } from "@/game/engine";

export const ATTACK_DURATION = 800;
export const ATTACK_IMPACT = 0.56;

export function attackChannel(event: BattleEvent) {
  if ((event.kind === "attack" || event.kind === "miss") && event.actor && event.target)
    return event.channel;
  return undefined;
}

export function prepareAttackMotion(
  board: HTMLElement,
  projectile: HTMLElement,
  impact: HTMLElement,
  event: BattleEvent,
) {
  const channel = attackChannel(event);
  if (
    !channel ||
    typeof board.animate !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return [];

  const troops = [...board.querySelectorAll<HTMLElement>("[data-battle-unit]")];
  const source = troops.find((el) => el.dataset["battleUnit"] === event.actor);
  const target = troops.find((el) => el.dataset["battleUnit"] === event.target);
  const sourceFace = source?.querySelector(".battle-token-face")?.getBoundingClientRect();
  const targetFace = target?.querySelector(".battle-token-face")?.getBoundingClientRect();
  if (!source || !target || !sourceFace || !targetFace) return [];

  const field = board.getBoundingClientRect();
  const startX = sourceFace.left - field.left + sourceFace.width / 2;
  const startY = sourceFace.top - field.top + sourceFace.height / 2;
  const endX = targetFace.left - field.left + targetFace.width / 2;
  const endY = targetFace.top - field.top + targetFace.height / 2;
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const directionX = dx / distance;
  const directionY = dy / distance;
  const miss = event.kind === "miss";
  const animations: Animation[] = [];
  const transform = (x: number, y: number) => `translate(${x}px, ${y}px)`;
  const add = (element: HTMLElement, frames: Keyframe[]) => {
    const animation = element.animate(frames, { duration: ATTACK_DURATION, fill: "both" });
    animation.pause();
    animation.currentTime = 0;
    animations.push(animation);
  };

  if (channel === "steel") {
    const reach = Math.max(0, distance - Math.min(sourceFace.width, targetFace.width) * 0.4);
    const swing = miss ? 18 : 0;
    add(source, [
      { transform: transform(0, 0), offset: 0 },
      {
        transform: transform(-directionX * 9, -directionY * 9),
        offset: 0.2,
        easing: "cubic-bezier(.6, 0, .8, .7)",
      },
      {
        transform: transform(
          directionX * reach - directionY * swing,
          directionY * reach + directionX * swing,
        ),
        offset: ATTACK_IMPACT,
        easing: "ease-out",
      },
      { transform: transform(0, 0), offset: 0.9 },
      { transform: transform(0, 0), offset: 1 },
    ]);
  } else {
    const dodge = miss ? Math.min(targetFace.height * 0.55, 36) : 0;
    const landingX = endX - directionY * dodge;
    const landingY = endY + directionX * dodge;
    const angle = Math.atan2(landingY - startY, landingX - startX);
    const pose = (x: number, y: number, size = 1) =>
      `${transform(x, y)} translate(-50%, -50%) rotate(${angle}rad) scale(${size})`;
    const arc = channel === "spell" ? Math.min(distance * 0.18, 54) : 0;
    add(projectile, [
      { transform: pose(startX, startY, 0.45), opacity: 0, offset: 0 },
      { transform: pose(startX, startY), opacity: 1, offset: 0.12 },
      {
        transform: pose((startX + landingX) / 2, (startY + landingY) / 2 - arc),
        opacity: 1,
        offset: 0.33,
      },
      { transform: pose(landingX, landingY), opacity: 1, offset: ATTACK_IMPACT },
      { transform: pose(landingX, landingY, 0.65), opacity: 0, offset: 0.64 },
      { transform: pose(landingX, landingY, 0.65), opacity: 0, offset: 1 },
    ]);
  }

  if (miss) {
    const dodge = Math.min(targetFace.height * 0.22, 18);
    add(target, [
      { transform: transform(0, 0), offset: 0 },
      { transform: transform(0, 0), offset: 0.42 },
      {
        transform: transform(directionY * dodge, -directionX * dodge),
        offset: ATTACK_IMPACT,
        easing: "ease-out",
      },
      { transform: transform(0, 0), offset: 0.87 },
      { transform: transform(0, 0), offset: 1 },
    ]);
  } else {
    add(target, [
      { transform: transform(0, 0), offset: 0 },
      { transform: transform(0, 0), offset: ATTACK_IMPACT },
      { transform: transform(directionX * 9, directionY * 9), offset: 0.65, easing: "ease-out" },
      { transform: transform(-directionX * 2, -directionY * 2), offset: 0.76 },
      { transform: transform(0, 0), offset: 0.87 },
      { transform: transform(0, 0), offset: 1 },
    ]);
  }

  const effectPose = (scale: number) =>
    `${transform(endX, endY)} translate(-50%, -50%) scale(${scale})`;
  add(impact, [
    { transform: effectPose(0.48), opacity: 0, offset: 0 },
    { transform: effectPose(0.48), opacity: 0, offset: ATTACK_IMPACT - 0.01 },
    { transform: effectPose(0.85), opacity: 1, offset: ATTACK_IMPACT },
    { transform: effectPose(1.35), opacity: 0, offset: 0.94 },
    { transform: effectPose(1.35), opacity: 0, offset: 1 },
  ]);
  return animations;
}
