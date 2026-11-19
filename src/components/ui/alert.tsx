import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One alert for every banner. Colours come from the theme tokens (--success, --warning-text,
 * --destructive), so contrast is decided once in index.css.
 */
const alertVariants = cva("flex items-start gap-2 rounded-lg border p-3 text-sm", {
  variants: {
    variant: {
      info: "border-border bg-muted/40 text-foreground [&>svg]:text-muted-foreground",
      success: "border-success/40 bg-success/10 text-success",
      warning: "border-warning/50 bg-warning/10 text-warning-text",
      destructive: "border-destructive/30 bg-destructive/10 text-destructive",
    },
  },
  defaultVariants: { variant: "info" },
});

export type AlertVariant = NonNullable<VariantProps<typeof alertVariants>["variant"]>;

const ICONS: Record<AlertVariant, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: AlertCircle,
};

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">, VariantProps<typeof alertVariants> {
  /** Replace the default icon for the variant, or pass `null` for none. */
  icon?: React.ReactNode | null;
  /** Renders a dismiss button; called when it is pressed. */
  onDismiss?: () => void;
  dismissLabel?: string;
}

/**
 * Destructive alerts are announced assertively (`role="alert"`); everything else is a polite
 * `role="status"` so a banner that is present on page load does not interrupt the screen reader.
 */
const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "info", icon, onDismiss, dismissLabel = "Dismiss", role, children, ...props }, ref) => {
    const resolved: AlertVariant = variant ?? "info";
    const Icon = ICONS[resolved];
    return (
      <div
        ref={ref}
        role={role ?? (resolved === "destructive" ? "alert" : "status")}
        data-variant={resolved}
        className={cn(alertVariants({ variant: resolved }), className)}
        {...props}
      >
        {icon === null ? null : (icon ?? <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />)}
        <div className="min-w-0 flex-1 space-y-1">{children}</div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={dismissLabel}
            className="-m-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  },
);
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("font-medium leading-snug text-current", className)} {...props} />
  ),
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("leading-snug text-current", className)} {...props} />,
);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription, alertVariants };
