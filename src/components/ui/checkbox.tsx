import { cn } from "@/lib/utils";

// Native checkbox with a monochrome accent + a consistent label row. Uses accent-current so the
// check matches the foreground color in both themes.
export function Checkbox({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2 text-sm", className)}>
      <input
        type="checkbox"
        className="h-4 w-4 accent-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-ring"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}
