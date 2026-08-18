// Shared ticket constants and types. Plain module (no "use server"), safe to import from client
// and server. The values must match the CHECK-free status column in migration 0004.

export const TICKET_STATUSES = ["open", "in_progress", "resolved"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

export interface TicketActionState {
  error?: string;
  ok?: boolean;
}
