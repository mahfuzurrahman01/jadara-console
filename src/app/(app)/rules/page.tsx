import Link from "next/link";
import { getRuleConfig } from "@/lib/agent/rules";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { RuleBuilder } from "@/components/agent/rule-builder";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const config = await getRuleConfig();

  return (
    <div>
      <PageHeader
        title="Qualification rules"
        subtitle="Decide when a conversation counts as a qualified lead"
      />

      <div className="px-4 py-6 sm:px-8">
        {!config || config.fieldOptions.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-sm text-muted">
                Add the fields your agent collects first, then come back to build the rule.{" "}
                <Link href="/agent" className="font-medium text-foreground hover:underline">
                  Go to Agent setup
                </Link>
                .
              </p>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Rule</CardTitle>
            </CardHeader>
            <CardBody>
              <RuleBuilder config={config} />
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
