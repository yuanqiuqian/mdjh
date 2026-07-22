import { Link } from "react-router-dom";
import { GameRuntimeActions } from "@/components/game/runtime/GameRuntimeActions";
import { GameRuntimeModalHost } from "@/components/game/runtime/GameRuntimeModalHost";
import { CombatSceneDesktop } from "@/components/game/runtime/CombatSceneDesktop";
import { CombatSceneMobile } from "@/components/game/runtime/CombatSceneMobile";
import { DialogueSceneDesktop } from "@/components/game/runtime/DialogueSceneDesktop";
import { DialogueSceneMobile } from "@/components/game/runtime/DialogueSceneMobile";
import { GameOverScene } from "@/components/game/runtime/GameOverScene";
import { useGameRuntime } from "@/components/game/runtime/useGameRuntime";
import { AppFrame } from "@/components/layout/AppFrame";
import { SectionCard } from "@/components/ui/SectionCard";

type GameRuntimeProps = {
  surface: "desktop" | "mobile";
};

export function GameRuntime({ surface }: GameRuntimeProps) {
  const state = useGameRuntime();

  const renderContent = () => {
    if (!state.activeSave) {
      return (
        <SectionCard eyebrow="提示" title="尚无存档">
          <div className="space-y-4">
            <p className="text-sm text-stone-400">
              你还没有存档。先选择门派开局，才能开始离线修行与剧情推进。
            </p>
            <Link
              to="/"
              className="inline-flex w-fit rounded-[18px] bg-amber-400/15 px-4 py-2 text-sm text-amber-100 transition hover:bg-amber-400/25"
            >
              回首页开始新游戏
            </Link>
          </div>
        </SectionCard>
      );
    }

    if (state.activeSave.gameMode === "gameover") {
      return <GameOverScene state={state} />;
    }

    if (state.activeSave.gameMode === "combat" && state.combat) {
      return surface === "mobile" ? (
        <CombatSceneMobile state={state} />
      ) : (
        <CombatSceneDesktop state={state} />
      );
    }

    return surface === "mobile" ? (
      <DialogueSceneMobile state={state} />
    ) : (
      <DialogueSceneDesktop state={state} />
    );
  };

  return (
    <AppFrame
      title={surface === "mobile" ? "移动江湖" : "当前剧情"}
      subtitle={
        state.activeSave
          ? `${state.activeSave.player.location} · ${state.activeSave.player.title} · 等级 ${state.activeSave.player.stats.level}`
          : "尚无存档，请先开始新游戏。"
      }
      actions={<GameRuntimeActions surface={surface} state={state} />}
      className={surface === "mobile" ? "pb-4" : undefined}
    >
      {renderContent()}
      <GameRuntimeModalHost state={state} />
    </AppFrame>
  );
}
