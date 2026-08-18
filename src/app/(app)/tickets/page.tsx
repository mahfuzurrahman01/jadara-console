import { listTickets } from "@/lib/tickets/queries";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { TicketBoard } from "@/components/tickets/ticket-board";

export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const tickets = await listTickets();
  const openCount = tickets.filter((t) => t.status !== "resolved").length;

  return (
    <div>
      <PageHeader
        title="Tickets"
        subtitle="Customers who asked to speak with a person. Drag a ticket to change its status. The agent stays paused until the ticket is resolved."
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
          <TicketBoard tickets={tickets} />
        )}
      </div>
    </div>
  );
}
