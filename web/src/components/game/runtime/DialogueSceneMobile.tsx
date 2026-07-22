import { Link } from "react-router-dom";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatDateTime, formatDelta } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GameRuntimeState } from "@/components/game/runtime/useGameRuntime";

type DialogueSceneMobileProps = {
  state: GameRuntimeState;
};

export function DialogueSceneMobile({ state }: DialogueSceneMobileProps) {
  if (!state.activeSave) {
    return null;
  }

  return (
    <div className="grid gap-3 pb-28">
      <SectionCard eyebrow="江湖回响" title={state.echoTitle}>
        <div className="space-y-4">
          <div ref={state.storyScrollRef} className="whitespace-pre-wrap text-sm leading-7 text-stone-200">
            {state.echoNarrative}
            {state.isGenerating ? (
              <span className="ml-1 inline-block h-4 w-[2px] translate-y-[2px] animate-pulse rounded-full bg-amber-200/80 align-middle" />
            ) : null}
          </div>

          {state.isGenerating ? (
            <div className="rounded-[18px] border border-amber-300/20 bg-amber-300/5 px-4 py-3">
              <p className="text-sm text-amber-100">剧情续写中</p>
              <p className="mt-1 text-xs leading-5 text-amber-100/65">
                新文本会一点点写出来，结束后自动结算本回合。
              </p>
              {state.currentStoryRequest ? (
                <p className="mt-3 rounded-[16px] bg-black/20 px-3 py-2 text-xs leading-5 text-stone-300">
                  本轮输入：{state.currentStoryRequest}
                </p>
              ) : null}
            </div>
          ) : null}

          {state.latest?.deltas ? (
            <div className="flex flex-wrap gap-2 text-xs text-stone-400">
              {typeof state.latest.deltas.hp === "number" ? (
                <span className="rounded-full bg-white/5 px-3 py-1">HP {formatDelta(state.latest.deltas.hp)}</span>
              ) : null}
              {typeof state.latest.deltas.mp === "number" ? (
                <span className="rounded-full bg-white/5 px-3 py-1">MP {formatDelta(state.latest.deltas.mp)}</span>
              ) : null}
              {typeof state.latest.deltas.exp === "number" ? (
                <span className="rounded-full bg-white/5 px-3 py-1">EXP {formatDelta(state.latest.deltas.exp)}</span>
              ) : null}
              {typeof state.latest.deltas.money === "number" ? (
                <span className="rounded-full bg-white/5 px-3 py-1">银两 {formatDelta(state.latest.deltas.money)}</span>
              ) : null}
            </div>
          ) : null}

          {!state.isGenerating && state.activeSave.suggestedActions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {state.activeSave.suggestedActions.slice(0, 5).map((action) => (
                <button
                  type="button"
                  key={action}
                  onClick={() => state.setInput(action)}
                  className="rounded-[16px] bg-amber-400/10 px-3 py-1.5 text-xs text-amber-100 transition hover:bg-amber-400/20"
                >
                  {action}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard eyebrow="状态" title="当前身心">
        <div className="grid gap-2 text-xs text-stone-400">
          <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-center justify-between">
              <span>HP</span>
              <span className="text-stone-100">
                {state.activeSave.player.stats.hp}/{state.activeSave.player.stats.hpMax}
              </span>
            </div>
          </div>
          <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-center justify-between">
              <span>MP</span>
              <span className="text-stone-100">
                {state.activeSave.player.stats.mp}/{state.activeSave.player.stats.mpMax}
              </span>
            </div>
          </div>
          <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-center justify-between">
              <span>银两</span>
              <span className="text-stone-100">{state.activeSave.player.money}</span>
            </div>
          </div>
          <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-[11px] text-stone-500">
            最近更新：{formatDateTime(state.activeSave.updatedAt)}
          </div>
        </div>
      </SectionCard>

      <SectionCard eyebrow="快捷功能" title="移动端入口">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => state.openModal("character")}
            className="rounded-[18px] bg-white/5 px-4 py-3 text-stone-100 transition hover:bg-white/10"
          >
            个人状态
          </button>
          <button
            type="button"
            onClick={() => state.openModal("inventory")}
            className="rounded-[18px] bg-white/5 px-4 py-3 text-stone-100 transition hover:bg-white/10"
          >
            背包
          </button>
          <button
            type="button"
            onClick={() => state.openModal("relations")}
            className="rounded-[18px] bg-white/5 px-4 py-3 text-stone-100 transition hover:bg-white/10"
          >
            关系
          </button>
          <button
            type="button"
            onClick={() => state.openModal("logs")}
            className="rounded-[18px] bg-white/5 px-4 py-3 text-stone-100 transition hover:bg-white/10"
          >
            日志
          </button>
        </div>
      </SectionCard>

      <SectionCard eyebrow="离线" title="本地修行">
        <div className="space-y-3">
          <div className="rounded-[18px] border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-xs leading-5 text-amber-100/85">
            <p>本幕剩余修行次数：{state.trainingStatus?.remainingUses ?? 0}/2</p>
            <p className="mt-1 text-amber-100/65">同一幕最多修行 2 次，且同一招式只能使用 1 次。</p>
          </div>
          <div className="grid gap-2">
            {state.trainingActions.map((action) => {
              const isUsed = state.trainingStatus?.usedActionLabels.has(action.label) ?? false;
              const isLocked = state.trainingStatus?.needsStoryAdvance ?? false;
              const disabled = isUsed || isLocked;
              return (
                <button
                  type="button"
                  key={action.id}
                  disabled={disabled}
                  onClick={() => state.applyTrainingAction(action.id)}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-[18px] border px-4 py-3 text-left transition",
                    disabled
                      ? "border-white/10 bg-white/5 text-stone-500"
                      : "border-white/10 bg-white/5 hover:bg-white/10",
                  )}
                >
                  <div>
                    <p className="text-sm text-stone-100">{action.label}</p>
                    <p className="mt-1 text-xs text-stone-500">{action.description}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-stone-500">
                    {isLocked ? "需推进剧情" : isUsed ? "已用" : `EXP ${formatDelta(action.deltas.exp)}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </SectionCard>

      <SectionCard eyebrow="最近记录" title="回放">
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

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#090909]/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-16px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          <textarea
            value={state.input}
            onChange={(event) => state.setInput(event.target.value)}
            onKeyDown={state.handleInputKeyDown}
            placeholder="输入你的行动或对白…"
            rows={2}
            className="w-full resize-none rounded-[18px] border border-white/10 bg-black/40 px-4 py-3 text-sm text-stone-100 outline-none placeholder:text-stone-600 focus:border-amber-300/40"
          />
          {state.lastStoryError ? (
            <p className="text-xs text-rose-300">{state.lastStoryError}</p>
          ) : !state.isOnline ? (
            <p className="text-xs text-stone-500">当前离线，无法联网推进剧情。</p>
          ) : !state.configReady ? (
            <p className="text-xs text-stone-500">
              模型尚未验证，请先回首页或系统设置中完成接入。
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!state.canProgress}
              onClick={state.submitProgress}
              className={cn(
                "flex-1 rounded-[18px] px-4 py-3 text-sm transition",
                state.canProgress
                  ? "bg-amber-400/15 text-amber-100 hover:bg-amber-400/25"
                  : "bg-white/5 text-stone-500",
              )}
            >
              {state.isGenerating ? "推演中…" : "推进剧情"}
            </button>
            <button
              type="button"
              onClick={state.submitNote}
              className="rounded-[18px] bg-white/5 px-4 py-3 text-sm text-stone-100 transition hover:bg-white/10"
            >
              随手记
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

