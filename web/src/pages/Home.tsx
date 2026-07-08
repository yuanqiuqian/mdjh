import { Link } from "react-router-dom";
import { AppFrame } from "@/components/layout/AppFrame";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

export default function Home() {
  const activeSave = useAppStore((state) => state.activeSave);
  const llmConfig = useAppStore((state) => state.llmConfig);
  const validation = useAppStore((state) => state.validation);
  const isOnline = useAppStore((state) => state.isOnline);

  const configReady =
    Boolean(llmConfig?.lastValidatedAt) && validation.status === "success";

  return (
    <AppFrame
      title="山门前"
      subtitle="你可以先整理行囊、配置模型、开一局新档，或在离线状态下进行本地修行与回放。"
    >
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <SectionCard eyebrow="当前进度" title="最近的江湖脚步">
          {activeSave ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-stone-200">
                    {activeSave.player.title} · {activeSave.player.name}
                  </p>
                  <p className="text-xs text-stone-500">
                    {activeSave.player.location} · 最后更新{" "}
                    {formatDateTime(activeSave.updatedAt)}
                  </p>
                </div>
                <Link
                  to="/game"
                  className="rounded-[18px] bg-amber-400/15 px-4 py-2 text-sm text-amber-100 transition hover:bg-amber-400/25"
                >
                  继续行旅
                </Link>
              </div>
              <div className="grid gap-3 rounded-[22px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between text-xs text-stone-400">
                  <span>HP</span>
                  <span className="text-stone-200">
                    {activeSave.player.stats.hp}/{activeSave.player.stats.hpMax}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/5">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-rose-500/70 to-amber-400/70"
                    style={{
                      width: `${
                        (activeSave.player.stats.hp /
                          activeSave.player.stats.hpMax) *
                        100
                      }%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-stone-400">
                  <span>MP</span>
                  <span className="text-stone-200">
                    {activeSave.player.stats.mp}/{activeSave.player.stats.mpMax}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/5">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-cyan-500/60 to-amber-300/60"
                    style={{
                      width: `${
                        (activeSave.player.stats.mp /
                          activeSave.player.stats.mpMax) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>
              <div className="grid gap-2 text-xs leading-5 text-stone-400">
                <p>最近事件：{activeSave.recentEvents[0]?.title ?? "尚未记录"}</p>
                <p>建议动作：{activeSave.suggestedActions.join(" · ")}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-stone-400">
                你还没有创建存档。选择门派、落下一次誓言，从山门一步踏入江湖。
              </p>
              <Link
                to="/new-game"
                className="inline-flex w-fit rounded-[18px] bg-amber-400/15 px-4 py-2 text-sm text-amber-100 transition hover:bg-amber-400/25"
              >
                开启新局
              </Link>
            </div>
          )}
        </SectionCard>

        <div className="grid gap-4">
          <SectionCard eyebrow="连接状态" title="江湖的风向">
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                <div className="space-y-1">
                  <p className="text-sm text-stone-200">
                    {isOnline ? "在线" : "离线"}
                  </p>
                  <p className="text-xs text-stone-500">
                    {isOnline
                      ? "可测试模型配置；剧情推进将按 OpenAI 兼容协议请求。"
                      : "离线时只能本地修行与查看存档。"}
                  </p>
                </div>
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    isOnline ? "bg-emerald-400" : "bg-stone-500",
                  )}
                />
              </div>

              <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-sm text-stone-200">
                  {configReady ? "模型已就绪" : "尚未验证模型"}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  {configReady
                    ? "验证通过后可在“行旅”页直接推进剧情。"
                    : "未验证时会拦截联网剧情推进，但不会影响回放与离线修行。"}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link
                    to="/llm-config"
                    className="rounded-[16px] bg-white/5 px-3 py-1.5 text-xs text-stone-100 transition hover:bg-white/10"
                  >
                    前往配置
                  </Link>
                  {validation.message ? (
                    <span className="text-xs text-stone-500">{validation.message}</span>
                  ) : null}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard eyebrow="卷册入口" title="整理行囊">
            <div className="grid gap-2 text-sm text-stone-300">
              <Link
                to="/codex"
                className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 transition hover:bg-white/10"
              >
                <span>角色、关系、背包、存档与日志</span>
                <span className="text-xs text-stone-500">进入</span>
              </Link>
              <Link
                to="/game"
                className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 transition hover:bg-white/10"
              >
                <span>直接打开游戏主界面</span>
                <span className="text-xs text-stone-500">进入</span>
              </Link>
            </div>
          </SectionCard>
        </div>
      </div>
    </AppFrame>
  );
}
