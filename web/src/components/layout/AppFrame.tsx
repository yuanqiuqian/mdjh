import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AppFrameProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/**
 * Provides the shared application shell with a compact desktop header.
 */
export function AppFrame({
  title,
  subtitle,
  children,
  actions,
  className,
}: AppFrameProps) {
  return (
    <div className="min-h-screen bg-[#050505] text-stone-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-[-8rem] h-[24rem] bg-[radial-gradient(circle_at_top,_rgba(217,179,86,0.2),_transparent_52%)]" />
        <div className="absolute left-[-10%] top-[18%] h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-[-8%] top-[35%] h-80 w-80 rounded-full bg-rose-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_30%,rgba(255,255,255,0.03))]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-10 pt-5 sm:px-6 xl:px-8 xl:pt-4">
        <header className="mb-5 flex items-start justify-between gap-4 xl:mb-4 xl:items-end xl:gap-3">
          <div className="space-y-2">
            <h1 className="font-serif text-[28px] leading-tight text-stone-50 sm:text-[34px] xl:text-[32px]">
              {title}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-stone-400 xl:leading-5">
              {subtitle}
            </p>
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </header>

        <main className={cn("flex-1", className)}>{children}</main>
      </div>
    </div>
  );
}
