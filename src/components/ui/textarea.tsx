import { cn } from "@/lib/utils";
import { inputBase } from "./input";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(inputBase, "field-sizing-content min-h-20 px-3 py-2 leading-relaxed", className)}
      {...props}
    />
  );
}
