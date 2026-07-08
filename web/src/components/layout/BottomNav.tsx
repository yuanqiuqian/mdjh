import { BookOpen, Compass, Gamepad2, ScrollText, Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "首页", icon: Compass },
  { to: "/new-game", label: "新局", icon: Sparkles },
  { to: "/game", label: "行旅", icon: Gamepad2 },
  { to: "/codex", label: "卷册", icon: BookOpen },
  { to: "/llm-config", label: "模型", icon: ScrollText },
];

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-6xl px-4 pb-4">
      <div className="grid grid-cols-5 rounded-[24px] border border-white/10 bg-stone-950/90 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 rounded-[18px] px-2 py-3 text-[11px] transition",
                  isActive
                    ? "bg-amber-400/10 text-amber-200"
                    : "text-stone-400 hover:bg-white/5 hover:text-stone-100",
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

