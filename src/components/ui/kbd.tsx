import { cn } from "@/lib/utils";

/** Keyboard key hint, e.g. <Kbd>⌘</Kbd><Kbd>K</Kbd>. */
export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-sm border border-border bg-muted px-1",
        "font-sans text-[11px] font-medium text-muted-foreground select-none [&_svg:not([class*='size-'])]:size-3",
        className,
      )}
      {...props}
    />
  );
}

export function KbdGroup({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="kbd-group" className={cn("inline-flex items-center gap-1", className)} {...props} />;
}
