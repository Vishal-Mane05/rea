import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const sizes = { xs: "size-3", sm: "size-3.5", md: "size-4", lg: "size-6", xl: "size-8" } as const;

export interface SpinnerProps extends React.ComponentProps<"span"> {
  size?: keyof typeof sizes;
  /** Accessible label announced to screen readers. Pass `null` when the parent already announces state. */
  label?: string | null;
}

/** Indeterminate loading indicator. */
export function Spinner({ size = "md", label = "Loading", className, ...props }: SpinnerProps) {
  return (
    <span
      data-slot="spinner"
      role={label ? "status" : undefined}
      aria-live={label ? "polite" : undefined}
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      {...props}
    >
      <Loader2 aria-hidden className={cn("animate-spin", sizes[size])} />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
