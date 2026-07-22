import { Link } from "react-router-dom";
import { SectionCard } from "@/components/ui/SectionCard";
import type { GameRuntimeState } from "@/components/game/runtime/useGameRuntime";

type GameOverSceneProps = {
  state: GameRuntimeState;
};

export function GameOverScene({ state }: GameOverSceneProps) {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-18rem)] max-w-4xl place-items-center">
      <SectionCard
        eyebrow="终局"
        title="游戏结束"
        className="relative w-full overflow-hidden border-rose-300/15 bg-[radial-gradient(circle_at_top,_rgba(190,24,93,0.16),_transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-0 shadow-[0_30px_100px_rgba(0,0,0,0.52)]"
      >
        <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(244,63,94,0.18),transparent)]" />
        <div className="absolute right-[-4rem] top-10 h-40 w-40 rounded-full bg-rose-500/10 blur-3xl" />
        <div className="absolute left-[-3rem] bottom-0 h-32 w-32 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative grid gap-6 px-6 py-8 sm:px-8 sm:py-10">
          <div className="space-y-3 border-b border-white/10 pb-6">
            <p className="text-[11px] uppercase tracking-[0.38em] text-rose-200/70">Battle Lost</p>
            <h3 className="font-serif text-[32px] leading-tight text-stone-50 sm:text-[40px]">
              胜败乃兵家常事
            </h3>
            <p className="max-w-2xl text-base leading-8 text-stone-300">
              大侠请重新来过。你在这一战中力竭倒下，这段江湖路暂时走到了尽头，
              但江湖从不只认一场胜负。
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[24px] border border-white/10 bg-black/25 p-5">
              <p className="text-[11px] uppercase tracking-[0.26em] text-stone-500">最后记录</p>
              <p className="mt-3 text-base text-stone-100">{state.latest?.title ?? "战斗结算"}</p>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-stone-400">
                {state.latest?.outcome ?? "这场恶战已经划下句点。"}
              </p>
            </div>

            <div className="grid gap-3">
              <div className="rounded-[24px] border border-rose-300/15 bg-rose-400/8 p-5">
                <p className="text-[11px] uppercase tracking-[0.26em] text-rose-200/70">败北提示</p>
                <p className="mt-3 text-sm leading-7 text-stone-300">
                  你可以回到首页直接开启新局，或读取之前保留下来的稳定进度，再次挑战这一关。
                </p>
              </div>

              <div className="grid gap-3 rounded-[24px] border border-white/10 bg-white/5 p-4">
                <Link
                  to="/"
                  className="rounded-[18px] bg-amber-400/18 px-4 py-3 text-center text-sm text-amber-50 transition hover:bg-amber-400/28"
                >
                  返回首页，重新开始
                </Link>
                <button
                  type="button"
                  onClick={() => state.openModal("saves")}
                  className="rounded-[18px] bg-white/5 px-4 py-3 text-sm text-stone-100 transition hover:bg-white/10"
                >
                  读取之前的进度
                </button>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

