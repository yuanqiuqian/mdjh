import { Suspense, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LazyModelSettingsForm, LazyNewGamePicker, LazySaveSlotsPanel } from "@/components/game/lazy";
import { AppFrame } from "@/components/layout/AppFrame";
import { SectionCard } from "@/components/ui/SectionCard";
import { ModalFrame } from "@/components/ui/ModalFrame";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

type HomeModalKey = "new-game" | "load-game" | "model-settings" | null;

function HomeModalLoadingFallback() {
  return <p className="text-sm text-stone-400">内容加载中…</p>;
}

export default function Home() {
  const navigate = useNavigate();
  const activeSave = useAppStore((state) => state.activeSave);
  const llmConfig = useAppStore((state) => state.llmConfig);
  const validation = useAppStore((state) => state.validation);
  const isOnline = useAppStore((state) => state.isOnline);
  const [activeModal, setActiveModal] = useState<HomeModalKey>(null);

  const configReady =
    Boolean(llmConfig?.lastValidatedAt) && validation.status === "success";

  return (
    <AppFrame
      title="山门前"
      subtitle="从这里开始新的故事、读取已有进度，或先把模型接入准备好。"
    >
      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionCard eyebrow="主菜单" title="开始游戏">
          <div className="grid gap-3">
            <a
              href="#"
              onClick={(event) => {
                event.preventDefault();
                setActiveModal("new-game");
              }}
              className="rounded-[22px] border border-amber-300/20 bg-amber-400/10 px-5 py-4 text-left transition hover:bg-amber-400/18"
            >
              <p className="text-base text-amber-100">新的开始</p>
              <p className="mt-1 text-xs text-amber-100/65">选择门派，直接进入开局剧情。</p>
            </a>
            <a
              href="#"
              onClick={(event) => {
                event.preventDefault();
                setActiveModal("load-game");
              }}
              className="rounded-[22px] border border-white/10 bg-white/5 px-5 py-4 text-left transition hover:bg-white/10"
            >
              <p className="text-base text-stone-100">读取进度</p>
              <p className="mt-1 text-xs text-stone-500">
                {activeSave
                  ? `当前进度：${activeSave.player.title} · ${formatDateTime(activeSave.updatedAt)}`
                  : "查看存档位并读取已有游戏进度。"}
              </p>
            </a>
            <a
              href="#"
              onClick={(event) => {
                event.preventDefault();
                setActiveModal("model-settings");
              }}
              className="rounded-[22px] border border-white/10 bg-white/5 px-5 py-4 text-left transition hover:bg-white/10"
            >
              <p className="text-base text-stone-100">模型设置</p>
              <p className="mt-1 text-xs text-stone-500">配置 endpoint、model_id、api_key 并测试连接。</p>
            </a>
          </div>
        </SectionCard>

        <div className="grid gap-4">
          <SectionCard eyebrow="最近进度" title={activeSave ? "上次停留" : "尚未创建进度"}>
            {activeSave ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-stone-200">
                    {activeSave.player.title} · {activeSave.player.name}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    {activeSave.player.location} · 最近更新 {formatDateTime(activeSave.updatedAt)}
                  </p>
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
                        width: `${(activeSave.player.stats.hp / activeSave.player.stats.hpMax) * 100}%`,
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
                        width: `${(activeSave.player.stats.mp / activeSave.player.stats.mpMax) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="grid gap-2 text-xs leading-5 text-stone-400">
                  <p>最近事件：{activeSave.recentEvents[0]?.title ?? "尚未记录"}</p>
                  <p>建议动作：{activeSave.suggestedActions.join(" · ")}</p>
                </div>
                <a
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    navigate("/game");
                  }}
                  className="inline-flex w-fit rounded-[18px] bg-white/5 px-4 py-2 text-sm text-stone-100 transition hover:bg-white/10"
                >
                  直接进入当前剧情
                </a>
              </div>
            ) : (
              <div className="space-y-3 text-sm text-stone-400">
                <p>你还没有创建进度。先点“新的开始”，再从山门踏进江湖。</p>
                <p className="text-xs text-stone-500">
                  模型状态：{configReady ? "已就绪" : "未验证"} · {isOnline ? "在线" : "离线"}
                </p>
              </div>
            )}
          </SectionCard>

          <SectionCard eyebrow="当前状态" title="连接与模型">
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                <div className="space-y-1">
                  <p className="text-sm text-stone-200">{isOnline ? "在线" : "离线"}</p>
                  <p className="text-xs text-stone-500">
                    {isOnline ? "可以测试模型并联网推进剧情。" : "当前只能使用本地功能与存档管理。"}
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
                <p className="text-sm text-stone-200">{configReady ? "模型已就绪" : "模型尚未验证"}</p>
                <p className="mt-1 text-xs text-stone-500">{validation.message}</p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
      {activeModal === "new-game" ? (
        <ModalFrame
          title="新的开始"
          description="选择门派，立刻进入开局剧情。"
          onClose={() => setActiveModal(null)}
        >
          <Suspense fallback={<HomeModalLoadingFallback />}>
            <LazyNewGamePicker
              onCreated={() => {
                setActiveModal(null);
                navigate("/game");
              }}
            />
          </Suspense>
        </ModalFrame>
      ) : null}
      {activeModal === "load-game" ? (
        <ModalFrame
          title="读取进度"
          description="选择一个存档位，读取后直接进入当前剧情。"
          onClose={() => setActiveModal(null)}
          widthClassName="max-w-4xl"
        >
          <Suspense fallback={<HomeModalLoadingFallback />}>
            <LazySaveSlotsPanel
              onLoaded={() => {
                setActiveModal(null);
                navigate("/game");
              }}
            />
          </Suspense>
        </ModalFrame>
      ) : null}
      {activeModal === "model-settings" ? (
        <ModalFrame
          title="模型设置"
          description="填写 endpoint、model_id、api_key，并测试当前模型连接。"
          onClose={() => setActiveModal(null)}
          widthClassName="max-w-6xl"
        >
          <Suspense fallback={<HomeModalLoadingFallback />}>
            <LazyModelSettingsForm />
          </Suspense>
        </ModalFrame>
      ) : null}
    </AppFrame>
  );
}
