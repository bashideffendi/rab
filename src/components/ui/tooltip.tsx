import { cn } from "@/lib/utils";

/**
 * Tooltip CSS-only — muncul instan saat hover, tidak ada delay 700ms
 * seperti native title attribute. Pakai dengan membungkus elemen target.
 *
 * <Tooltip content="Hapus project">
 *   <button>...</button>
 * </Tooltip>
 */
export function Tooltip({
  content,
  children,
  side = "top",
  className,
}: {
  content: string;
  children: React.ReactNode;
  side?: "top" | "bottom";
  className?: string;
}) {
  const sideClasses =
    side === "top"
      ? "bottom-full left-1/2 mb-1.5 -translate-x-1/2"
      : "top-full left-1/2 mt-1.5 -translate-x-1/2";

  return (
    <span className={cn("group/tooltip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background opacity-0 shadow-md transition-opacity duration-100 group-hover/tooltip:opacity-100",
          sideClasses,
        )}
      >
        {content}
      </span>
    </span>
  );
}
