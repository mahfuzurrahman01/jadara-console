import { cn } from "@/lib/utils";

// Label + optional hint wrapper for a form control. Keeps label typography consistent everywhere.
export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

// Inline form error / notice. Monochrome, calm.
export function FormNotice({ children, tone = "error" }: { children: React.ReactNode; tone?: "error" | "ok" }) {
  if (!children) return null;
  return (
    <p
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        tone === "error"
          ? "border-border bg-surface text-foreground"
          : "border-foreground/20 bg-surface text-foreground",
      )}
    >
      {children}
    </p>
  );
}
