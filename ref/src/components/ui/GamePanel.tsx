import type { CSSProperties, ReactNode } from "react";

type GamePanelProps = {
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  scroll?: boolean;
  style?: CSSProperties;
  as?: "section" | "div";
};

/** Reusable 9-slice wooden panel. */
export function GamePanel({ children, className = "", bodyClassName = "", width, height, scroll = false, style, as = "section" }: GamePanelProps) {
  const Tag = as;
  return (
    <Tag className={`game-panel ${className}`.trim()} style={{ width, height, ...style }}>
      {scroll || className.split(/\s+/).includes("hud-content") ? <div className={`game-panel-body${scroll ? " is-scroll" : ""} ${bodyClassName}`.trim()}>{children}</div> : children}
    </Tag>
  );
}
