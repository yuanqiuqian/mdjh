import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppFrame } from "@/components/layout/AppFrame";
import { SectionCard } from "@/components/ui/SectionCard";
import { sects } from "@/data/game-data";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

export default function NewGame() {
  const navigate = useNavigate();
  const createGame = useAppStore((state) => state.createGame);
  const activeSave = useAppStore((state) => state.activeSave);

  const initial = useMemo(() => activeSave?.player.sectId ?? sects[0]?.id ?? "wudang", [activeSave]);
  const [selected, setSelected] = useState<string>(initial);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <AppFrame
      title="择门立誓"
      subtitle="八大门派各有所长，选定门派后将以默认少年身世开启第一幕：山贼拦路。"
      actions={
        <button
          type="button"
          disabled={isCreating}
          onClick={async () => {
            setIsCreating(true);
            await createGame(selected);
            setIsCreating(false);
            navigate("/game");
          }}
          className={cn(
            "rounded-[18px] px-4 py-2 text-sm transition",
            isCreating
              ? "bg-white/5 text-stone-500"
              : "bg-amber-400/15 text-amber-100 hover:bg-amber-400/25",
          )}
        >
          {isCreating ? "落笔中…" : "开局入江湖"}
        </button>
      }
    >
      <SectionCard eyebrow="门派选择" title="八大门派">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sects.map((sect) => {
            const isActive = sect.id === selected;
            return (
              <button
                type="button"
                key={sect.id}
                onClick={() => setSelected(sect.id)}
                className={cn(
                  "rounded-[22px] border p-4 text-left transition",
                  isActive
                    ? "border-amber-300/40 bg-amber-400/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10",
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-serif text-lg text-stone-100">{sect.name}</p>
                    <p className="mt-1 text-xs text-stone-500">{sect.type} · {sect.weapon}</p>
                  </div>
                  {isActive ? (
                    <span className="rounded-full bg-amber-300/20 px-2 py-1 text-[11px] text-amber-100">
                      已选
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-6 text-stone-300">{sect.flavor}</p>
                <div className="mt-4 grid gap-1 text-xs text-stone-400">
                  <p>门派特性：{sect.trait}</p>
                  <p>入门招式：{sect.starterSkill}</p>
                </div>
              </button>
            );
          })}
        </div>
      </SectionCard>
    </AppFrame>
  );
}

