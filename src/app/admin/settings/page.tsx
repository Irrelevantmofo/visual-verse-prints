import { Card, PageHeader } from "@/components/ui";
import { getSettings } from "@/lib/queries";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <>
      <PageHeader title="Settings" />
      <Card className="max-w-xl p-5">
        <SettingsForm
          ratePct={+(settings.default_commission_rate * 100).toFixed(2)}
          validityDays={settings.quote_validity_days}
          dueSoonDays={settings.due_soon_days}
        />
      </Card>
    </>
  );
}
