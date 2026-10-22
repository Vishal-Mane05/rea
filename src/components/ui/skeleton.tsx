import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-shimmer rounded-md bg-muted dark:bg-accent", className)}
      {...props}
    />
  );
}
