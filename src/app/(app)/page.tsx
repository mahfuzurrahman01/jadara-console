import Link from "next/link";
import { listConversations, getDashboardStats } from "@/lib/dashboard/queries";
import { requireTenant } from "@/lib/auth/dal";
import { relativeTime, initials } from "@/lib/dashboard/format";
import { PageHeader } from "@/components/shell/page-header";
import { StaggerList, StaggerItem, HoverCard, FadeIn } from "@/components/motion/stagger";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  const [conversations, tenant, stats] = await Promise.all([
    listConversations(),
    requireTenant(),
    getDashboardStats(),
  ]);

  return (
    <div>
      <PageHeader
        title="Conversations"
        subtitle={`Live WhatsApp intake for ${tenant.tenantName}`}
      />

      <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
        <FadeIn className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Conversations" value={stats.conversations} />
          <StatCard label="Qualified" value={stats.qualified} emphasis />
          <StatCard label="Leads sent" value={stats.leads} href="/leads" />
          <StatCard
            label="Open tickets"
            value={stats.openTickets}
            href="/tickets"
            emphasis={stats.openTickets > 0}
          />
        </FadeIn>

        {conversations.length === 0 ? (
          <EmptyState />
        ) : (
          <StaggerList className="flex flex-col gap-3">
            {conversations.map((c) => (
              <StaggerItem key={c.id}>
                <HoverCard>
                  <Link
                    href={`/conversations/${c.id}`}
                    className="flex items-center gap-4 rounded-xl border border-border bg-surface/60 px-5 py-4 transition-colors hover:bg-surface-hover"
                  >
                    <span
                      className={
                        c.status === "qualified"
                          ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-medium text-background"
                          : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-sm font-medium"
                      }
                    >
                      {initials(c.contactName, c.waId)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {c.contactName ?? c.waId.replace(/@.*/, "")}
                        </span>
                        <span className="tnum text-xs text-muted">{c.messageCount} msgs</span>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted">
                        {c.lastMessage ?? "No messages yet"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusBadge status={c.status} />
                      <span className="tnum text-xs text-muted">{relativeTime(c.lastAt)}</span>
                    </div>
                  </Link>
                </HoverCard>
              </StaggerItem>
            ))}
          </StaggerList>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
      <p className="font-display text-lg font-medium">No conversations yet</p>
      <p className="mt-1 max-w-sm text-sm text-muted">
        Send a WhatsApp message to the linked number and it will appear here as the agent replies.
      </p>
    </div>
  );
}
