import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  [
    "inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
    "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
    "[&>svg]:pointer-events-none [&>svg]:size-3",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        destructive: "border-transparent bg-destructive-soft text-destructive-soft-foreground",
        success: "border-transparent bg-success-soft text-success-soft-foreground",
        warning: "border-transparent bg-warning-soft text-warning-soft-foreground",
        info: "border-transparent bg-info-soft text-info-soft-foreground",
        primary: "border-transparent bg-primary-soft text-primary-soft-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.ComponentProps<"span">, VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

export function Badge({ className, variant, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot.Root : "span";
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
