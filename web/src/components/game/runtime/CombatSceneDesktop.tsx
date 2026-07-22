import { Link } from "react-router-dom";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GameRuntimeState } from "@/components/game/runtime/useGameRuntime";

type CombatSceneDesktopProps = {
  state: GameRuntimeState;
};

export function CombatSceneDesktop({ state }: CombatSceneDesktopProps) {
  if (!state.activeSave || !state.combat) {
    return null;
  }

  return (
    <div className="grid gap-3 xl:min-h-[calc(100vh-13rem)] xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] xl:items-start">
      <div className="grid gap-3">
        <SectionCard eyebrow="交战模式" title={`${state.combat.title} · 第 ${state.combat.round} 回合`}>
          <div className="space-y-4">
            <div className="rounded-[20px] border border-rose-300/20 bg-rose-400/5 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-rose-100/70">战斗目标</p>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px]",
                    state.isGenerating
                      ? "bg-amber-300/10 text-amber-100"
                      : state.isCombatAnimating
                        ? "bg-cyan-300/10 text-cyan-100"
                        : "bg-emerald-300/10 text-emerald-100",
                  )}
                >
                  {state.isGenerating
                    ? "战后续写中"
                    : state.isCombatAnimating
                      ? "本回合结算中"
                      : "轮到你行动"}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-stone-100">{state.combat.objective}</p>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-stone-400">
                {state.combatHeadline}
              </p>
            </div>

            <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">回合节奏</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-[16px] bg-amber-400/10 px-3 py-2 text-center text-amber-100">
                  1. 你出手
                </div>
                <div
                  className={cn(
                    "rounded-[16px] px-3 py-2 text-center",
                    state.isCombatAnimating
                      ? "bg-cyan-400/10 text-cyan-100"
                      : "bg-white/5 text-stone-500",
                  )}
                >
                  2. 敌方应对
                </div>
                <div
                  className={cn(
                    "rounded-[16px] px-3 py-2 text-center",
                    !state.isCombatAnimating && !state.isGenerating
                      ? "bg-emerald-400/10 text-emerald-100"
                      : "bg-white/5 text-stone-500",
                  )}
                >
                  3. 下一回合
                </div>
              </div>
              <p className="mt-3 rounded-[16px] bg-black/20 px-3 py-2 text-xs leading-5 text-stone-300">
                {state.combatBeatText}
              </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[20px] border border-emerald-300/20 bg-emerald-400/5 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-stone-100">{state.combat.player.name}</p>
                  <span className="text-xs text-stone-500">我方</span>
                </div>
                <div className="mt-3 space-y-3 text-xs text-stone-300">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span>HP</span>
                      <span>{state.combat.player.hp}/{state.combat.player.hpMax}</span>
                    </div>
                    <div className="h-2 rounded-full bg-black/30">
                      <div
                        className="h-2 rounded-full bg-rose-300/80 transition-all"
                        style={{ width: `${(state.combat.player.hp / state.combat.player.hpMax) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span>MP</span>
                      <span>{state.combat.player.mp}/{state.combat.player.mpMax}</span>
                    </div>
                    <div className="h-2 rounded-full bg-black/30">
                      <div
                        className="h-2 rounded-full bg-cyan-300/80 transition-all"
                        style={{ width: `${(state.combat.player.mp / Math.max(1, state.combat.player.mpMax)) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-[16px] bg-black/20 px-3 py-2">攻击 {state.combat.player.atk}</div>
                    <div className="rounded-[16px] bg-black/20 px-3 py-2">护甲 {state.combat.player.arm}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">选定目标</p>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {state.livingEnemies.map((enemy) => (
                    <button
                      type="button"
                      key={enemy.id}
                      onClick={() => state.setCombatTargetId(enemy.id)}
                      className={cn(
                        "min-w-[180px] shrink-0 rounded-[18px] border px-4 py-3 text-left transition",
                        state.combatTargetId === enemy.id
                          ? "border-amber-300/40 bg-amber-400/10"
                          : "border-white/10 bg-white/5 hover:bg-white/10",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-stone-100">{enemy.name}</p>
                          <p className="mt-1 text-[11px] text-stone-500">
                            {enemy.isBoss ? "首领" : "敌方"} · LV {enemy.level}
                          </p>
                        </div>
                        <span className="text-[11px] text-stone-500">
                          {state.combatTargetId === enemy.id ? "已锁定" : "可选"}
                        </span>
                      </div>
                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between text-[11px] text-stone-400">
                          <span>HP</span>
                          <span>{enemy.hp}/{enemy.hpMax}</span>
                        </div>
                        <div className="h-2 rounded-full bg-black/30">
                          <div
                            className="h-2 rounded-full bg-rose-300/80 transition-all"
                            style={{ width: `${(enemy.hp / enemy.hpMax) * 100}%` }}
                          />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard eyebrow="回合操作" title="本回合指令">
          <div className="grid gap-4">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={state.livingEnemies.length === 0 || state.combatActionLocked}
                onClick={() =>
                  state.submitCombatAction({
                    type: "attack",
                    targetId: state.combatTargetId || state.livingEnemies[0]?.id || "",
                  })
                }
                className={cn(
                  "rounded-[18px] px-4 py-3 text-sm transition",
                  state.livingEnemies.length > 0 && !state.combatActionLocked
                    ? "bg-amber-400/15 text-amber-100 hover:bg-amber-400/25"
                    : "bg-white/5 text-stone-500",
                )}
              >
                进攻
              </button>
              <button
                type="button"
                disabled={state.combatActionLocked}
                onClick={() => state.submitCombatAction({ type: "defend" })}
                className={cn(
                  "rounded-[18px] px-4 py-3 text-sm transition",
                  !state.combatActionLocked
                    ? "bg-white/5 text-stone-100 hover:bg-white/10"
                    : "bg-white/5 text-stone-500",
                )}
              >
                防御
              </button>
              <button
                type="button"
                disabled={state.combatActionLocked}
                onClick={() => state.submitCombatAction({ type: "flee" })}
                className={cn(
                  "rounded-[18px] px-4 py-3 text-sm transition",
                  !state.combatActionLocked
                    ? "bg-white/5 text-stone-100 hover:bg-white/10"
                    : "bg-white/5 text-stone-500",
                )}
              >
                逃跑
              </button>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">技能</p>
                <div className="grid gap-2">
                  {state.combat.player.skills.map((skill) => (
                    <button
                      type="button"
                      key={skill.id}
                      disabled={state.combatActionLocked}
                      onClick={() =>
                        state.submitCombatAction({
                          type: "skill",
                          skillId: skill.id,
                          targetId:
                            skill.target === "enemy"
                              ? state.combatTargetId || state.livingEnemies[0]?.id
                              : undefined,
                        })
                      }
                      className={cn(
                        "rounded-[18px] border px-4 py-3 text-left transition",
                        !state.combatActionLocked
                          ? "border-white/10 bg-white/5 hover:bg-white/10"
                          : "border-white/10 bg-white/5 text-stone-500",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-stone-100">{skill.name}</span>
                        <span className="text-[11px] text-stone-500">MP {skill.mpCost}</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-stone-500">{skill.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.24em] text-stone-500">道具</p>
                <div className="grid gap-2">
                  {state.consumables.length > 0 ? (
                    state.consumables.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        disabled={state.combatActionLocked}
                        onClick={() => state.submitCombatAction({ type: "item", itemId: item.id })}
                        className={cn(
                          "rounded-[18px] border px-4 py-3 text-left transition",
                          !state.combatActionLocked
                            ? "border-white/10 bg-white/5 hover:bg-white/10"
                            : "border-white/10 bg-white/5 text-stone-500",
                        )}
                      >
                        <p className="text-sm text-stone-100">{item.name}</p>
                        <p className="mt-1 text-xs leading-5 text-stone-500">{item.description}</p>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-xs text-stone-500">
                      当前没有可用消耗品。
                    </div>
                  )}
                </div>
              </div>
            </div>

            {(state.combatActionLocked || state.isGenerating) ? (
              <div className="rounded-[18px] border border-cyan-300/20 bg-cyan-300/5 px-4 py-3 text-xs leading-5 text-cyan-100/90">
                {state.isGenerating
                  ? "战斗已经结束，AI 正在接续战后剧情。"
                  : "当前回合正在依次结算，请先看完你来我往的过程。"}
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-3 xl:max-h-[calc(100vh-13rem)] xl:overflow-y-auto xl:pr-1 xl:pb-2">
        <SectionCard eyebrow="战斗播报" title="按回合回放">
          <div className="space-y-3">
            {state.combatRounds.length > 0 ? (
              state.combatRounds.map((roundGroup) => (
                <div key={roundGroup.round} className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-stone-100">第 {roundGroup.round} 回合</p>
                    <span className="text-[11px] text-stone-600">{roundGroup.items.length} 步</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {roundGroup.items.map((log) => (
                      <div
                        key={log.id}
                        className={cn(
                          "rounded-[16px] px-3 py-2 text-xs leading-5",
                          log.actorId === "player"
                            ? "bg-amber-400/10 text-amber-100"
                            : "bg-white/5 text-stone-300",
                        )}
                      >
                        <p className="text-[11px] opacity-75">{log.actorName}</p>
                        <p className="mt-1 whitespace-pre-wrap">{log.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone-400">
                {state.combat.introNarrative}
              </div>
            )}
            {state.isCombatAnimating ? (
              <div className="rounded-[18px] border border-cyan-300/20 bg-cyan-300/5 px-4 py-3 text-xs text-cyan-100">
                本回合正在分步播报中……
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard eyebrow="记录" title="最近记录">
          <div className="space-y-3">
            {state.visibleEvents.map((event) => (
              <div key={event.id} className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-stone-100">{event.title}</p>
                  <span className="text-[11px] text-stone-600">{formatDateTime(event.timestamp)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-stone-400">
                  {event.outcome}
                </p>
              </div>
            ))}
            <Link
              to="#"
              onClick={(event) => {
                event.preventDefault();
                state.openModal("logs");
              }}
              className="block rounded-[18px] bg-white/5 px-4 py-3 text-center text-xs text-stone-300 transition hover:bg-white/10"
            >
              打开日志查看全部
            </Link>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

