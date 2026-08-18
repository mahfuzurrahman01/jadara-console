import { getCurrentTenant } from "@/lib/auth/dal";
import { redirect } from "next/navigation";

// Public auth shell (no sidebar). Already-signed-in users are bounced to the dashboard.
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const tenant = await getCurrentTenant();
  if (tenant) redirect("/");

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 font-display text-lg font-semibold tracking-tight">Jadara</div>
        {children}
      </div>
    </div>
  );
}
