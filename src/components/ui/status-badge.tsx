"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Status = "qualified" | "not_qualified" | "pending" | string;

const LABEL: Record<string, string> = {
  qualified: "Qualified",
  not_qualified: "Not qualified",
  pending: "Pending",
};

// Animated status pill. Re-keys on the status value so a flip to qualified plays a calm pop.
export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const label = LABEL[status] ?? status;
  return (
    <motion.span
      key={status}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] as const }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        status === "qualified" && "bg-foreground text-background",
        status === "not_qualified" && "border border-border text-muted",
        status === "pending" && "bg-surface text-muted",
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "qualified" ? "bg-background" : "bg-muted",
        )}
      />
      {label}
    </motion.span>
  );
}
