"use client";

import { Label as LabelPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium text-foreground select-none",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-60 group-data-[disabled=true]:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
