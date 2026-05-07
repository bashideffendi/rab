import { cn } from "@/lib/utils";

type Tone = "default" | "draft" | "active" | "archived" | "accent";

const tones: Record<Tone, string> = {
  default: "border-border text-muted-foreground",
  draft: "border-border text-muted-foreground",
  active: "border-success/40 text-success",
  archived: "border-muted-foreground/40 text-muted-foreground",
  accent: "border-accent/40 text-accent",
};

export function Badge({
  tone = "default",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
