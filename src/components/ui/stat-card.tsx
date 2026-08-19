import Link from "next/link";
import { cn } from "@/lib/utils";

// Compact KPI tile for the top of the dashboard. Monochrome; the value is the emphasis. Renders as
// a link when `href` is set so a metric can jump to its detail view.
export function StatCard({
  label,
  value,
  hint,
  href,
  emphasis = false,
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
  emphasis?: boolean;
}) {
  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("tnum mt-2 font-display text-3xl font-semibold tracking-tight")}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </>
  );

  const cls = cn(
    "block rounded-xl border px-5 py-4 transition-colors",
    emphasis ? "border-foreground/25 bg-surface/60" : "border-border bg-surface/40",
    href && "hover:bg-surface-hover",
  );

  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
