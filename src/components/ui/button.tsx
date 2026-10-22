import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

export const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium select-none",
    "transition-[color,background-color,border-color,box-shadow,opacity] duration-150",
    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover active:bg-primary-hover/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent active:bg-accent/80",
        outline:
          "border border-input bg-card text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive-hover focus-visible:ring-destructive",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 gap-1.5 px-3 text-[13px]",
        md: "h-9 px-4",
        default: "h-9 px-4",
        lg: "h-10 px-5 text-[15px]",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-xs": "size-7 rounded-sm [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    compoundVariants: [{ variant: "link", class: "h-auto px-0" }],
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  /** Render the single child element with button styles (e.g. a Next `<Link>`). */
  asChild?: boolean;
  /** Shows a spinner, sets aria-busy and disables the button. Ignored with `asChild`. */
  loading?: boolean;
}

export function Button({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }: ButtonProps) {
  if (asChild) {
    return (
      <Slot.Root data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      data-slot="button"
      type={props.type ?? "button"}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner size="sm" label={null} />}
      {children}
    </button>
  );
}
