import { env } from "@/lib/env";

// Owner notification for a qualified lead. Uses Resend when RESEND_API_KEY is set, otherwise logs a
// concise line (the notification of record for the demo). Kept minimal on purpose: identifying
// detail stays out of general logs; a full summary only goes to the owner via email.
export interface LeadNotice {
  tenantName: string;
  ownerEmail: string | null;
  contactName: string | null;
  conversationId: string;
  crmRecordId: string | null;
}

export async function notifyLeadQualified(notice: LeadNotice): Promise<void> {
  const key = env.resendApiKey;
  // Log-only when Resend is not configured, or when we have no owner address to send to.
  if (!key || !notice.ownerEmail) {
    console.log("[notify] lead qualified", {
      conversationId: notice.conversationId,
      crmRecordId: notice.crmRecordId,
    });
    return;
  }

  // Resend is optional; if the send fails we log and move on rather than failing the turn.
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.resendFrom || "leads@notifications.local",
        to: notice.ownerEmail,
        subject: `${notice.tenantName}: new qualified lead${notice.contactName ? ` from ${notice.contactName}` : ""}`,
        text:
          `A new lead has qualified.\n\n` +
          `Name: ${notice.contactName ?? "Unknown"}\n` +
          `CRM record: ${notice.crmRecordId ?? "n/a"}\n` +
          `Conversation: ${notice.conversationId}\n`,
      }),
    });
    if (!res.ok) {
      console.warn("[notify] resend failed", { httpStatus: res.status });
    }
  } catch (err) {
    console.warn("[notify] resend error", (err as Error)?.message);
  }
}
