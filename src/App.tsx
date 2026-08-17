import { SceneRoot } from "./scene/SceneRoot";
import { HUD } from "./ui/HUD";
import { LoadingOverlay } from "./ui/LoadingOverlay";

export default function App() {
  return (
    <div className="app">
      <SceneRoot />
      <HUD />
      <LoadingOverlay />
    </div>
  );
}
