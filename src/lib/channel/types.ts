// ChannelProvider abstracts the messaging transport (WhatsApp today, others later). Agent,
// extraction, qualification, and integration code depend only on this interface; no OpenWA
// specifics leak past it. The demo is reply-driven, so we only need to send a text reply to a
// chat the customer already opened.
export interface ChannelProvider {
  readonly name: string;
  // Send a plain text reply. chatId is reused verbatim from the inbound payload, never constructed.
  sendText(sessionId: string, chatId: string, text: string): Promise<{ messageId: string }>;
}
