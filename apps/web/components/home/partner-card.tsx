import type { LucideIcon } from "lucide-react";

interface PartnerCardProps {
  name: string;
  role: string;
  icon: LucideIcon;
}

export function PartnerCard({ name, role, icon: Icon }: PartnerCardProps) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card/60 p-6 backdrop-blur transition-colors hover:border-primary/40">
      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="mt-5 text-base font-semibold tracking-tight">{name}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{role}</p>
    </div>
  );
}
