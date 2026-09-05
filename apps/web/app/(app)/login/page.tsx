import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@bnb-marketplace/ui";
import { AuthControls } from "@/components/auth-controls";

export default function LoginPage() {
  return (
    <div className="container flex justify-center py-16">
      <div className="w-full max-w-md">
        <Breadcrumbs items={[{ label: "Login" }]} />
        <Card>
          <CardHeader>
            <CardTitle>Connect your wallet</CardTitle>
            <CardDescription>
              Sign one SIWE message to authenticate this wallet on BNB Testnet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AuthControls />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
