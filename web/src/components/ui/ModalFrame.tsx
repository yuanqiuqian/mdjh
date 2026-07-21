import { useEffect, type ReactNode } from "react";

type ModalFrameProps = {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  widthClassName?: string;
};

/**
 * Renders a shared full-screen modal shell used across the home page and the in-game menu.
 */
export function ModalFrame({
  title,
  description,
  children,
  onClose,
  widthClassName = "max-w-5xl",
}: ModalFrameProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-[121] max-h-[min(88vh,960px)] w-full overflow-hidden rounded-[28px] border border-white/10 bg-[#090909]/96 shadow-[0_30px_120px_rgba(0,0,0,0.55)] ${widthClassName}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-serif text-xl text-stone-50">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm leading-6 text-stone-400">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[16px] bg-white/5 px-3 py-2 text-xs text-stone-300 transition hover:bg-white/10"
          >
            关闭
          </button>
        </div>
        <div className="max-h-[calc(min(88vh,960px)-92px)] overflow-y-auto px-5 py-5 sm:px-6">
          {children}
        </div>
      </div>
    </div>
  );
}
