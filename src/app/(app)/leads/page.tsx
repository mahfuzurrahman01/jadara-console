import Link from "next/link";
import { listLeads } from "@/lib/dashboard/queries";
import { relativeTime, initials } from "@/lib/dashboard/format";
import { PageHeader } from "@/components/shell/page-header";
import { StaggerList, StaggerItem, HoverCard } from "@/components/motion/stagger";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await listLeads();

  return (
    <div>
      <PageHeader
        title="Qualified leads"
        subtitle="Families that met every eligibility rule and were sent to the CRM"
        right={
          <Badge variant="solid" className="tnum">
            {leads.length} total
          </Badge>
        }
      />

      <div className="px-4 py-6 sm:px-8">
        {leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
            <p className="font-display text-lg font-medium">No qualified leads yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              When a conversation meets every rule, the beneficiary record is created and the lead
              shows up here.
            </p>
          </div>
        ) : (
          <StaggerList className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {leads.map((l) => (
              <StaggerItem key={l.conversationId}>
                <HoverCard>
                  <Link
                    href={`/conversations/${l.conversationId}`}
                    className="flex items-center gap-4 rounded-xl border border-border bg-surface/60 px-5 py-4 transition-colors hover:bg-surface-hover"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-medium text-background">
                      {initials(l.contactName, l.waId)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {l.contactName ?? l.waId.replace(/@.*/, "")}
                      </p>
                      <p className="tnum mt-0.5 truncate text-xs text-muted">
                        CRM {l.crmRecordId ? l.crmRecordId.slice(0, 8) : "pending"} ·{" "}
                        {relativeTime(l.createdAt)}
                      </p>
                    </div>
                    <Badge variant="outline">Lead</Badge>
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
