declare module "troika-three-text" {
  import { Mesh } from "three";

  /** Minimal surface of troika's Text used by the city label layer. */
  export class Text extends Mesh {
    text: string;
    font: string | null;
    fontSize: number;
    color: string | number;
    outlineColor: string | number;
    outlineWidth: string | number;
    anchorX: "left" | "center" | "right" | string | number;
    anchorY: "top" | "middle" | "bottom" | string | number;
    fillOpacity: number;
    outlineOpacity: number;
    sync(callback?: () => void): void;
    dispose(): void;
  }
}
