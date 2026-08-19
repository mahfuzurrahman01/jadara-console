"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BrandBlock, NavGroups, UserFooter } from "@/components/shell/sidebar";

// Mobile navigation: a sticky top bar with the workspace mark and a menu button, plus a slide-in
// drawer that reuses the same nav and user footer as the desktop rail. Hidden at md and up, where
// the persistent sidebar takes over.
export function MobileNav({
  tenantName,
  userName,
  email,
}: {
  tenantName: string;
  userName: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const mark = (tenantName || "W").charAt(0).toUpperCase();

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-xs font-semibold text-background">
            {mark}
          </span>
          <span className="min-w-0 truncate font-display text-base font-semibold tracking-tight">
            {tenantName || "Workspace"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-lg border border-border p-2 text-muted hover:bg-surface-hover hover:text-foreground"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/40"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", ease: [0.22, 1, 0.36, 1], duration: 0.28 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-background px-4 py-6"
            >
              <div className="flex items-start justify-between px-2">
                <BrandBlock tenantName={tenantName} />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="rounded-lg border border-border p-1.5 text-muted hover:bg-surface-hover hover:text-foreground"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="mt-8 flex-1 overflow-y-auto">
                <NavGroups onNavigate={() => setOpen(false)} />
              </div>
              <div className="mt-4">
                <UserFooter userName={userName} email={email} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
