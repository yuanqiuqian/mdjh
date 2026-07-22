import { cn } from "@/lib/utils";
import type { GameRuntimeState } from "@/components/game/runtime/useGameRuntime";

type GameRuntimeActionsProps = {
  surface: "desktop" | "mobile";
  state: GameRuntimeState;
};

export function GameRuntimeActions({ surface, state }: GameRuntimeActionsProps) {
  if (!state.activeSave) {
    return null;
  }

  if (surface === "mobile") {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => state.openModal("character")}
          className="rounded-[18px] bg-white/5 px-3 py-2 text-sm text-stone-100 transition hover:bg-white/10"
        >
          角色
        </button>
        <button
          type="button"
          onClick={() => state.openModal("system")}
          className="rounded-[18px] bg-white/5 px-3 py-2 text-sm text-stone-100 transition hover:bg-white/10"
        >
          系统
        </button>
        <button
          type="button"
          onClick={state.saveStablePoint}
          className="rounded-[18px] bg-white/5 px-3 py-2 text-sm text-stone-100 transition hover:bg-white/10"
        >
          存档
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div ref={state.menuRef} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={state.isMenuOpen}
          onClick={state.toggleMenu}
          className={cn(
            "flex items-center gap-2 rounded-[18px] px-4 py-2 text-sm transition",
            state.isMenuOpen
              ? "bg-amber-400/15 text-amber-100"
              : "bg-white/5 text-stone-100 hover:bg-white/10",
          )}
        >
          <span>菜单</span>
          <span
            className={cn(
              "text-[10px] text-stone-500 transition",
              state.isMenuOpen ? "rotate-180 text-amber-100/80" : "",
            )}
          >
            v
          </span>
        </button>
        {state.isMenuOpen ? (
          <div className="absolute right-0 top-[calc(100%+0.6rem)] z-20 w-72 overflow-hidden rounded-[24px] border border-amber-300/15 bg-stone-950/96 shadow-[0_24px_80px_rgba(0,0,0,0.48)] backdrop-blur-xl">
            <div className="border-b border-white/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.28em] text-amber-300/70">
                游戏菜单
              </p>
              <p className="mt-1 text-sm text-stone-300">人物、背包、日志、存档都从这里打开。</p>
            </div>
            <div className="grid gap-1 p-2">
              {state.menuItems.map((item, index) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => state.openModal(item.id)}
                  className="flex w-full items-start gap-3 rounded-[18px] px-3 py-3 text-left transition hover:bg-white/5"
                >
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-[11px] text-stone-400">
                    0{index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-stone-100">{item.label}</span>
                    <span className="mt-1 block text-[11px] leading-5 text-stone-500">
                      {item.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => state.setDebugMode(!state.debugMode)}
        className={cn(
          "rounded-[18px] px-4 py-2 text-sm transition",
          state.debugMode
            ? "bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/25"
            : "bg-white/5 text-stone-100 hover:bg-white/10",
        )}
      >
        {state.debugMode ? "Debug 开" : "Debug 关"}
      </button>
      <button
        type="button"
        onClick={state.saveStablePoint}
        className="rounded-[18px] bg-white/5 px-4 py-2 text-sm text-stone-100 transition hover:bg-white/10"
      >
        存为稳定点
      </button>
    </div>
  );
}
