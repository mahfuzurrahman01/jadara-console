import Link from "next/link";
import { listTickets } from "@/lib/tickets/queries";
import { updateTicketStatus } from "@/lib/tickets/actions";
import { relativeTime, initials } from "@/lib/dashboard/format";
import { PageHeader } from "@/components/shell/page-header";
import { StaggerList, StaggerItem } from "@/components/motion/stagger";
import { Badge } from "@/components/ui/badge";
import { TICKET_STATUSES, TICKET_STATUS_LABEL } from "@/lib/tickets/constants";

export const dynamic = "force-dynamic";

const STATUS_VARIANT = {
  open: "solid",
  in_progress: "outline",
  resolved: "muted",
} as const;

export default async function TicketsPage() {
  const tickets = await listTickets();
  const openCount = tickets.filter((t) => t.status !== "resolved").length;

  return (
    <div>
      <PageHeader
        title="Tickets"
        subtitle="Customers who asked to speak with a person. The agent pauses until you resolve them."
        right={
          <Badge variant="solid" className="tnum">
            {openCount} open
          </Badge>
        }
      />

      <div className="px-8 py-6">
        {tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
            <p className="font-display text-lg font-medium">No tickets yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              When a customer asks to talk to a real person, a ticket is opened here and the agent
              stops auto-replying on that conversation.
            </p>
          </div>
        ) : (
          <StaggerList className="flex flex-col gap-3">
            {tickets.map((t) => (
              <StaggerItem key={t.id}>
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface/60 px-5 py-4 sm:flex-row sm:items-center">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-medium text-background">
                    {initials(t.contactName, t.waId ?? "")}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">
                        {t.contactName ?? (t.waId ? t.waId.replace(/@.*/, "") : "Unknown")}
                      </p>
                      <Badge variant={STATUS_VARIANT[t.status]}>
                        {TICKET_STATUS_LABEL[t.status]}
                      </Badge>
                      {t.source === "manual" && <Badge variant="muted">manual</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {t.reason} · {relativeTime(t.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/conversations/${t.conversationId}`}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:bg-surface-hover hover:text-foreground"
                    >
                      Open chat
                    </Link>
                    <form action={updateTicketStatus} className="flex items-center gap-2">
                      <input type="hidden" name="ticketId" value={t.id} />
                      <select
                        name="status"
                        defaultValue={t.status}
                        className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
                      >
                        {TICKET_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {TICKET_STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:opacity-90"
                      >
                        Update
                      </button>
                    </form>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerList>
        )}
      </div>
    </div>
  );
}
