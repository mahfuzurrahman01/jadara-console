"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { logout } from "@/lib/auth/actions";
import { initials } from "@/lib/dashboard/format";

const NAV_GROUPS = [
  {
    label: "Inbox",
    items: [
      { href: "/", label: "Conversations" },
      { href: "/leads", label: "Qualified leads" },
      { href: "/tickets", label: "Tickets" },
    ],
  },
  {
    label: "Setup",
    items: [
      { href: "/connect", label: "WhatsApp" },
      { href: "/agent", label: "Agent setup" },
      { href: "/rules", label: "Qualification rules" },
      { href: "/integrations", label: "Integration" },
    ],
  },
];

export function Sidebar({
  tenantName,
  userName,
  email,
}: {
  tenantName: string;
  userName: string;
  email: string;
}) {
  const pathname = usePathname();
  const mark = (tenantName || "W").charAt(0).toUpperCase();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border px-4 py-6 md:flex">
      <div className="px-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Jadara</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-xs font-semibold text-background">
            {mark}
          </span>
          <span className="min-w-0 truncate font-display text-lg font-semibold tracking-tight">
            {tenantName || "Workspace"}
          </span>
        </div>
        <p className="mt-1 pl-9 text-xs text-muted">Intake console</p>
      </div>

      <nav className="mt-8 flex flex-col gap-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/70">
              {group.label}
            </p>
            {group.items.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} className="relative">
                  <motion.span
                    whileHover={{ x: active ? 0 : 2 }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                      "flex items-center rounded-lg px-3 py-2 text-sm",
                      active
                        ? "bg-foreground text-background"
                        : "text-muted hover:bg-surface-hover hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </motion.span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-medium">
            {initials(userName, email)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{userName || "Owner"}</p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <ThemeToggle />
          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:bg-surface-hover hover:text-foreground"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
