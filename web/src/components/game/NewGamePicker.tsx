import { useMemo, useState } from "react";
import { sects } from "@/data/game-data";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

type NewGamePickerProps = {
  onCreated: () => void;
};

/**
 * Lets the player choose a sect and start a new game inside a modal.
 */
export function NewGamePicker({ onCreated }: NewGamePickerProps) {
  const createGame = useAppStore((state) => state.createGame);
  const activeSave = useAppStore((state) => state.activeSave);
  const initial = useMemo(() => activeSave?.player.sectId ?? sects[0]?.id ?? "wudang", [activeSave]);
  const [selected, setSelected] = useState(initial);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="space-y-4">
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
      <div className="flex justify-end">
        <button
          type="button"
          disabled={isCreating}
          onClick={async () => {
            setIsCreating(true);
            await createGame(selected);
            setIsCreating(false);
            onCreated();
          }}
          className={cn(
            "rounded-[18px] px-4 py-2 text-sm transition",
            isCreating
              ? "bg-white/5 text-stone-500"
              : "bg-amber-400/15 text-amber-100 hover:bg-amber-400/25",
          )}
        >
          {isCreating ? "落笔中…" : "开始这段故事"}
        </button>
      </div>
    </div>
  );
}
