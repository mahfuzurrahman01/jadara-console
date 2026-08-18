import { getAgentConfig, listFields } from "@/lib/agent/config";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { PersonaForm } from "@/components/agent/persona-form";
import { FieldsManager } from "@/components/agent/fields-manager";

export const dynamic = "force-dynamic";

export default async function AgentSetupPage() {
  const agent = await getAgentConfig();
  if (!agent) {
    return (
      <div>
        <PageHeader title="Agent setup" subtitle="Configure how your WhatsApp agent behaves" />
        <div className="px-8 py-6">
          <p className="text-sm text-muted">No agent found for this workspace.</p>
        </div>
      </div>
    );
  }

  const fields = await listFields(agent.agentId);

  return (
    <div>
      <PageHeader
        title="Agent setup"
        subtitle="Set the persona and the information your agent collects from each customer"
      />

      <div className="flex flex-col gap-6 px-8 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Persona</CardTitle>
          </CardHeader>
          <CardBody>
            <PersonaForm agent={agent} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Fields to collect</CardTitle>
            <span className="tnum text-xs text-muted">{fields.length} fields</span>
          </CardHeader>
          <CardBody>
            <FieldsManager fields={fields} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
