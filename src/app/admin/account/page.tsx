import { PasswordForm } from "@/components/password-form";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Password" };

export default function AccountPage() {
  return (
    <>
      <PageHeader title="Password" description="Change the password you use to sign in." />
      <Card className="p-5">
        <PasswordForm />
      </Card>
    </>
  );
}
