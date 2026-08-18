import Link from "next/link";
import { listConversations } from "@/lib/dashboard/queries";
import { requireTenant } from "@/lib/auth/dal";
import { relativeTime, initials } from "@/lib/dashboard/format";
import { PageHeader } from "@/components/shell/page-header";
import { StaggerList, StaggerItem, HoverCard } from "@/components/motion/stagger";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  const [conversations, tenant] = await Promise.all([listConversations(), requireTenant()]);
  const open = conversations.length;
  const qualified = conversations.filter((c) => c.status === "qualified").length;

  return (
    <div>
      <PageHeader
        title="Conversations"
        subtitle={`Live WhatsApp intake for ${tenant.tenantName}`}
        right={
          <div className="flex gap-2">
            <Badge variant="muted" className="tnum">
              {open} total
            </Badge>
            <Badge variant="solid" className="tnum">
              {qualified} qualified
            </Badge>
          </div>
        }
      />

      <div className="px-8 py-6">
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
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-sm font-medium">
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
