import { cn } from "@/lib/utils";

type Tone = "default" | "draft" | "active" | "archived" | "accent";

const tones: Record<Tone, string> = {
  default: "border-border text-muted-foreground bg-muted",
  draft: "border-border text-muted-foreground bg-muted",
  active: "border-success/30 text-success bg-success/5",
  archived: "border-border text-muted-foreground bg-muted",
  accent: "border-accent/30 text-accent bg-accent/5",
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
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
