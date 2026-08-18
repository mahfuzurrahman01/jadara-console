"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { setTicketStatus } from "@/lib/tickets/actions";
import { relativeTime, initials } from "@/lib/dashboard/format";
import { Badge } from "@/components/ui/badge";
import { TICKET_STATUSES, TICKET_STATUS_LABEL, type TicketStatus } from "@/lib/tickets/constants";
import { cn } from "@/lib/utils";
import type { TicketRow } from "@/lib/tickets/queries";

// Drag-and-drop kanban of handoff tickets. Columns are the ticket statuses; dragging a card to a
// column sets that status. The move is optimistic (the card jumps immediately) and reverts if the
// server rejects it. Native HTML5 drag-and-drop, no dependency.
export function TicketBoard({ tickets: initial }: { tickets: TicketRow[] }) {
  const [tickets, setTickets] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TicketStatus | null>(null);
  const [, startTransition] = useTransition();

  function move(id: string, to: TicketStatus) {
    const current = tickets.find((t) => t.id === id);
    if (!current || current.status === to) return;

    const prev = tickets;
    setTickets((ts) => ts.map((t) => (t.id === id ? { ...t, status: to } : t)));
    startTransition(async () => {
      const res = await setTicketStatus(id, to);
      if (!res.ok) setTickets(prev); // revert on failure
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {TICKET_STATUSES.map((col) => {
        const items = tickets.filter((t) => t.status === col);
        return (
          <div
            key={col}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(col);
            }}
            onDragLeave={() => setOverCol((c) => (c === col ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              setOverCol(null);
              if (dragId) move(dragId, col);
              setDragId(null);
            }}
            className={cn(
              "flex min-h-[60vh] flex-col rounded-xl border border-border bg-surface/40 transition-colors",
              overCol === col && "border-foreground/40 bg-surface-hover",
            )}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-medium">{TICKET_STATUS_LABEL[col]}</span>
              <Badge variant="muted" className="tnum">
                {items.length}
              </Badge>
            </div>

            <div className="flex flex-1 flex-col gap-2 p-3">
              {items.length === 0 ? (
                <p className="py-10 text-center text-xs text-muted">Drop a ticket here</p>
              ) : (
                items.map((t) => (
                  <article
                    key={t.id}
                    draggable
                    onDragStart={() => setDragId(t.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverCol(null);
                    }}
                    className={cn(
                      "group cursor-grab rounded-lg border border-border bg-background px-4 py-3 shadow-sm transition active:cursor-grabbing",
                      dragId === t.id && "opacity-50",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-medium text-background">
                        {initials(t.contactName, t.waId ?? "")}
                      </span>
                      <p className="min-w-0 flex-1 truncate text-sm font-medium">
                        {t.contactName ?? (t.waId ? t.waId.replace(/@.*/, "") : "Unknown")}
                      </p>
                      {t.source === "manual" && <Badge variant="muted">manual</Badge>}
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-muted">{t.reason}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="tnum text-[11px] text-muted">{relativeTime(t.createdAt)}</span>
                      <Link
                        href={`/conversations/${t.conversationId}`}
                        className="text-[11px] text-muted underline-offset-2 hover:text-foreground hover:underline"
                      >
                        Open chat
                      </Link>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
