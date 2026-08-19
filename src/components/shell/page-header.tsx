import { FadeIn } from "@/components/motion/stagger";

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <FadeIn className="flex flex-col gap-3 border-b border-border px-4 py-6 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:px-8 sm:py-7">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </FadeIn>
  );
}
