import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionCardProps = {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
};

/**
 * Wraps page sections in a shared card style with tighter desktop spacing.
 */
export function SectionCard({
  title,
  eyebrow,
  children,
  className,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-[24px] border border-white/10 bg-black/30 p-4 shadow-[0_20px_64px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:p-5 xl:p-4",
        className,
      )}
    >
      {(eyebrow || title) && (
        <header className="mb-3 space-y-1 xl:mb-2">
          {eyebrow ? (
            <p className="text-[11px] uppercase tracking-[0.32em] text-amber-300/70">
              {eyebrow}
            </p>
          ) : null}
          {title ? (
            <h2 className="font-serif text-base text-stone-100 sm:text-lg">{title}</h2>
          ) : null}
        </header>
      )}
      {children}
    </section>
  );
}
