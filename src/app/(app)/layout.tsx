import { requireTenant } from "@/lib/auth/dal";
import { Sidebar } from "@/components/shell/sidebar";
import { MobileNav } from "@/components/shell/mobile-nav";

// Authenticated shell. requireTenant() redirects to /login when there is no valid session;
// it also resolves the tenant so the sidebar can show the workspace and the signed-in user.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const tenant = await requireTenant();

  return (
    <div className="relative z-10 flex min-h-screen flex-col md:flex-row">
      <MobileNav
        tenantName={tenant.tenantName}
        userName={tenant.userName}
        email={tenant.email}
      />
      <Sidebar
        tenantName={tenant.tenantName}
        userName={tenant.userName}
        email={tenant.email}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
