import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  ref?: React.Ref<HTMLInputElement>;
};

export function Input({ className, ref, ...props }: InputProps) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded border border-border bg-muted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground",
        "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, rows = 3, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(
        "w-full rounded border border-border bg-muted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground",
        "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
        "disabled:opacity-50",
        "resize-y min-h-[60px]",
        className,
      )}
      {...props}
    />
  );
}

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "w-full rounded border border-border bg-muted/40 px-3 py-2 text-sm text-foreground",
        "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
