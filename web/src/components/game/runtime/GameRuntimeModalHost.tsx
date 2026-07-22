import { Suspense } from "react";
import { LazyGamePanelContent, LazyModelSettingsForm } from "@/components/game/lazy";
import { ModalFrame } from "@/components/ui/ModalFrame";
import type { GameRuntimeState } from "@/components/game/runtime/useGameRuntime";

type GameRuntimeModalHostProps = {
  state: Pick<GameRuntimeState, "activeMenuItem" | "activeModal" | "closeModal" | "openModal">;
};

function ModalLoadingFallback() {
  return <p className="text-sm text-stone-400">内容加载中…</p>;
}

export function GameRuntimeModalHost({ state }: GameRuntimeModalHostProps) {
  if (!state.activeModal) {
    return null;
  }

  if (state.activeModal === "model-settings") {
    return (
      <ModalFrame
        title="模型设置"
        description="配置 endpoint、model_id、api_key，并测试当前模型连接。"
        onClose={state.closeModal}
        widthClassName="max-w-6xl"
      >
        <Suspense fallback={<ModalLoadingFallback />}>
          <LazyModelSettingsForm />
        </Suspense>
      </ModalFrame>
    );
  }

  if (!state.activeMenuItem) {
    return null;
  }

  return (
    <ModalFrame
      title={state.activeMenuItem.label}
      description={state.activeMenuItem.description}
      onClose={state.closeModal}
      widthClassName={state.activeMenuItem.id === "logs" ? "max-w-6xl" : "max-w-5xl"}
    >
      <Suspense fallback={<ModalLoadingFallback />}>
        <LazyGamePanelContent
          panel={state.activeMenuItem.id}
          onLoaded={state.closeModal}
          onOpenModelSettings={() => state.openModal("model-settings")}
        />
      </Suspense>
    </ModalFrame>
  );
}
