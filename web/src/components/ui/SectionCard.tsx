import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionCardProps = {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
};

export function SectionCard({
  title,
  eyebrow,
  children,
  className,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-white/10 bg-black/30 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl",
        className,
      )}
    >
      {(eyebrow || title) && (
        <header className="mb-4 space-y-1">
          {eyebrow ? (
            <p className="text-[11px] uppercase tracking-[0.32em] text-amber-300/70">
              {eyebrow}
            </p>
          ) : null}
          {title ? (
            <h2 className="font-serif text-lg text-stone-100">{title}</h2>
          ) : null}
        </header>
      )}
      {children}
    </section>
  );
}
