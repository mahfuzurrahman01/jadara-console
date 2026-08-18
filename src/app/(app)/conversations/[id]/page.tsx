import Link from "next/link";
import { notFound } from "next/navigation";
import { getConversationDetail } from "@/lib/dashboard/queries";
import { hasOpenTicket } from "@/lib/repo/ingest";
import { createTicketManual } from "@/lib/tickets/actions";
import { relativeTime, displayValue, initials } from "@/lib/dashboard/format";
import { StaggerList, StaggerItem, FadeIn } from "@/components/motion/stagger";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getConversationDetail(id);
  if (!detail) notFound();
  const ticketOpen = await hasOpenTicket(id);

  return (
    <div>
      <FadeIn className="flex items-center justify-between gap-4 border-b border-border px-8 py-7">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:bg-surface-hover hover:text-foreground"
          >
            Back
          </Link>
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-sm font-medium">
            {initials(detail.contactName, detail.waId)}
          </span>
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight">
              {detail.contactName ?? detail.waId.replace(/@.*/, "")}
            </h1>
            <p className="tnum text-sm text-muted">{detail.waId.replace(/@.*/, "")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {ticketOpen ? (
            <Link
              href="/tickets"
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:bg-surface-hover hover:text-foreground"
            >
              Handoff open
            </Link>
          ) : (
            <form action={createTicketManual}>
              <input type="hidden" name="conversationId" value={id} />
              <button
                type="submit"
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:bg-surface-hover hover:text-foreground"
              >
                Escalate to person
              </button>
            </form>
          )}
          <StatusBadge status={detail.status} />
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 gap-6 px-8 py-6 lg:grid-cols-[1fr_360px]">
        {/* Transcript */}
        <Card className="flex flex-col">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Transcript</CardTitle>
            <span className="tnum text-xs text-muted">{detail.messages.length} messages</span>
          </CardHeader>
          <CardBody>
            {detail.messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">No messages yet.</p>
            ) : (
              <StaggerList className="flex flex-col gap-3">
                {detail.messages.map((m, i) => {
                  const outbound = m.direction === "outbound";
                  return (
                    <StaggerItem
                      key={i}
                      className={cn("flex", outbound ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[78%] rounded-xl px-4 py-2.5 text-sm leading-relaxed",
                          outbound
                            ? "bg-foreground text-background"
                            : "border border-border bg-background",
                        )}
                      >
                        {m.content}
                        <div
                          className={cn(
                            "mt-1 text-[10px]",
                            outbound ? "text-background/60" : "text-muted",
                          )}
                        >
                          {outbound ? "Agent" : "Customer"} · {relativeTime(m.createdAt)}
                        </div>
                      </div>
                    </StaggerItem>
                  );
                })}
              </StaggerList>
            )}
          </CardBody>
        </Card>

        {/* Right rail */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Collected data</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-3">
              {detail.fields.map((f) => {
                const filled = f.value !== null && f.value !== undefined && f.value !== "";
                return (
                  <div key={f.key} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted">
                      {f.label}
                      {f.required && <span className="ml-1 text-muted">*</span>}
                    </span>
                    <span
                      className={cn(
                        "tnum text-sm font-medium",
                        filled ? "text-foreground" : "text-muted",
                      )}
                    >
                      {displayValue(f.value)}
                    </span>
                  </div>
                );
              })}
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Qualification</CardTitle>
              <StatusBadge status={detail.status} />
            </CardHeader>
            <CardBody>
              {detail.conditions.length === 0 ? (
                <p className="text-sm text-muted">
                  Not evaluated yet. The rule runs once fields are collected.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {detail.conditions.map((c, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <OutcomeMark outcome={c.outcome} />
                      <span className="text-muted">{c.field}</span>
                      <span className="tnum text-muted">
                        {c.op} {displayValue(c.value)}
                      </span>
                      <span className="tnum ml-auto font-medium">{displayValue(c.actual)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {detail.runs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Integration runs</CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-3">
                {detail.runs.map((r, i) => {
                  const resp = r.response as { body?: { id?: string } } | null;
                  return (
                    <div key={i} className="flex items-center justify-between gap-3 text-sm">
                      <span className="capitalize">{r.status}</span>
                      {resp?.body?.id && (
                        <span className="tnum truncate text-xs text-muted">
                          {resp.body.id.slice(0, 8)}
                        </span>
                      )}
                      <span className="tnum text-xs text-muted">{relativeTime(r.createdAt)}</span>
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function OutcomeMark({ outcome }: { outcome: string }) {
  const mark = outcome === "pass" ? "✓" : outcome === "fail" ? "✕" : "·";
  return (
    <span
      className={cn(
        "flex h-4 w-4 items-center justify-center rounded-full text-[10px]",
        outcome === "pass" && "bg-foreground text-background",
        outcome === "fail" && "border border-border text-muted",
        outcome === "missing" && "bg-surface text-muted",
      )}
    >
      {mark}
    </span>
  );
}
