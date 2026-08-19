import Link from "next/link";
import { getIntegrationConfig } from "@/lib/agent/integrations";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { IntegrationForm } from "@/components/agent/integration-form";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const config = await getIntegrationConfig();

  return (
    <div>
      <PageHeader
        title="Integration"
        subtitle="Where a qualified lead is sent. Called once, automatically, when a customer qualifies."
      />

      <div className="px-4 py-6 sm:px-8">
        {!config ? (
          <Card>
            <CardBody>
              <p className="text-sm text-muted">No agent found for this workspace.</p>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Endpoint</CardTitle>
            </CardHeader>
            <CardBody>
              {config.sourceOptions.length <= 1 && (
                <p className="mb-4 text-sm text-muted">
                  Tip: add the fields your agent collects on{" "}
                  <Link href="/agent" className="font-medium text-foreground hover:underline">
                    Agent setup
                  </Link>{" "}
                  so you can map them into the request.
                </p>
              )}
              <IntegrationForm config={config} />
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
