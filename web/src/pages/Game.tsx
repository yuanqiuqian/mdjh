import { GameRuntime } from "@/components/game/runtime/GameRuntime";
import { useIsHandset } from "@/hooks/useIsHandset";

export default function Game() {
  const isHandset = useIsHandset();

  return <GameRuntime surface={isHandset ? "mobile" : "desktop"} />;
}
