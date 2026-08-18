// Shape of OpenWA webhook deliveries. Derived from the OpenWA source:
//   modules/webhook/webhook.service.ts (envelope) and
//   engine/interfaces/whatsapp-engine.interface.ts (IncomingMessage = the message.received data).
// We type only the fields we consume; extra keys are ignored.

export type OpenwaEvent = "message.received" | "session.status" | (string & {});

export interface OpenwaIncomingMessage {
  id: string;
  from: string;
  to?: string;
  chatId?: string;
  body: string;
  type: string;
  timestamp?: number;
  fromMe: boolean;
  isGroup?: boolean;
  isStatusBroadcast?: boolean;
  isLidSender?: boolean;
  senderPhone?: string | null;
  contact?: { pushname?: string; name?: string; formattedName?: string };
}

export interface OpenwaSessionStatus {
  status?: string;
}

export interface OpenwaWebhookEnvelope {
  event?: OpenwaEvent;
  timestamp?: string;
  sessionId?: string;
  idempotencyKey?: string;
  deliveryId?: string;
  data?: OpenwaIncomingMessage & OpenwaSessionStatus;
}
