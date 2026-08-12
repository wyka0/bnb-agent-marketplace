import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@bnb-marketplace/ui";

export default function LoginPage() {
  return (
    <div className="container flex justify-center py-16">
      <div className="w-full max-w-md">
        <Breadcrumbs items={[{ label: "Login" }]} />
        <Card>
          <CardHeader>
            <CardTitle>Connect your wallet</CardTitle>
            <CardDescription>
              Wallet authentication is implemented in the auth phase. For now this is a placeholder
              route.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input disabled placeholder="Wallet connect coming soon" aria-label="Wallet connect" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
