import { Breadcrumbs } from "@/components/breadcrumbs";
import { Avatar } from "@bnb-marketplace/ui";

export default function ProfilePage() {
  return (
    <div className="container py-8">
      <Breadcrumbs items={[{ label: "Profile" }]} />
      <div className="mb-8 flex items-center gap-4">
        <Avatar fallback="U" size="lg" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground">
            Your identity, wallet, and publisher details will live here.
          </p>
        </div>
      </div>
    </div>
  );
}
