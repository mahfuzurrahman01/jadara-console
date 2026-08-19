import { PageHeader } from "@/components/shell/page-header";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { ConnectPanel } from "@/components/channel/connect-panel";

export const dynamic = "force-dynamic";

export default function ConnectPage() {
  return (
    <div>
      <PageHeader
        title="WhatsApp"
        subtitle="Link the number your customers will message. Use a dedicated number, not a personal one."
      />
      <div className="px-4 py-6 sm:px-8">
        <Card>
          <CardHeader>
            <CardTitle>Connection</CardTitle>
          </CardHeader>
          <CardBody>
            <ConnectPanel />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
