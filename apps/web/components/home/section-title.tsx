interface SectionTitleProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}

export function SectionTitle({ eyebrow, title, description, align = "center" }: SectionTitleProps) {
  const alignment = align === "center" ? "items-center text-center" : "items-start text-left";
  return (
    <div className={`flex flex-col ${alignment}`}>
      {eyebrow ? (
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {description ? (
        <p className="mt-4 max-w-2xl text-base text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
