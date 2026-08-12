interface StatCardProps {
  label: string;
  icon: React.ReactNode;
  hint?: string;
}

export function StatCard({ label, icon, hint }: StatCardProps) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-border bg-card/60 p-6 text-center backdrop-blur">
      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <p className="mt-4 text-3xl font-bold tracking-tight text-foreground">--</p>
      <p className="mt-1 text-sm font-medium text-foreground">{label}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
