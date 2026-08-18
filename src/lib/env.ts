// Central env access. Server-only values must never be imported into client components.

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const values = {
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey:
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",

  geminiApiKey: process.env.GEMINI_API_KEY ?? "",

  openwaBaseUrl: process.env.OPENWA_BASE_URL ?? "http://localhost:2785/api",
  openwaApiKey: process.env.OPENWA_API_KEY ?? "",
  openwaWebhookSecret: process.env.OPENWA_WEBHOOK_SECRET ?? "",
  openwaSessionId: process.env.OPENWA_SESSION_ID ?? "",

  appPublicUrl: process.env.APP_PUBLIC_URL ?? "http://localhost:3000",
  secretsEncryptionKey: process.env.SECRETS_ENCRYPTION_KEY ?? "",

  mockCrmToken: process.env.MOCK_CRM_TOKEN ?? "",

  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFrom: process.env.RESEND_FROM ?? "",
};

export const env = {
  ...values,
  requireServer(name: keyof typeof values): string {
    return required(String(name), values[name]);
  },
};
