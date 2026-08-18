import { cn } from "@/lib/utils";

type Variant = "solid" | "outline" | "muted";

// Monochrome badge. No color; emphasis via inversion (solid) or a hairline (outline).
export function Badge({
  variant = "outline",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variant === "solid" && "bg-foreground text-background",
        variant === "outline" && "border border-border text-foreground",
        variant === "muted" && "bg-surface text-muted",
        className,
      )}
      {...props}
    />
  );
}
