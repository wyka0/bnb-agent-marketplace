import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, CheckCircle2, Info, XCircle } from "./icons.js";
import { cn } from "../lib/utils.js";

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
        warning: "border-amber-500/50 text-amber-700 dark:text-amber-400 [&>svg]:text-amber-500",
        success:
          "border-emerald-500/50 text-emerald-700 dark:text-emerald-400 [&>svg]:text-emerald-500",
        info: "border-sky-500/50 text-sky-700 dark:text-sky-400 [&>svg]:text-sky-500",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

const iconByVariant: Record<string, React.ElementType> = {
  default: Info,
  destructive: XCircle,
  warning: AlertCircle,
  success: CheckCircle2,
};

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {}

function Alert({ className, variant = "default", children, ...props }: AlertProps) {
  const Icon = iconByVariant[variant ?? "default"] ?? Info;
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {children}
    </div>
  );
}
Alert.displayName = "Alert";

function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5 className={cn("mb-1 pl-7 font-medium leading-none tracking-tight", className)} {...props} />
  );
}
AlertTitle.displayName = "AlertTitle";

function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn("text-sm pl-7 [&_p]:leading-relaxed", className)} {...props} />;
}
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription, alertVariants };
