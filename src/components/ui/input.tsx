import { cn } from "@/lib/utils";

export const inputBase = [
  "w-full min-w-0 rounded-md border border-input bg-card text-sm text-foreground shadow-xs",
  "placeholder:text-muted-foreground/80",
  "transition-[border-color,box-shadow] duration-150 outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20",
  "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
  "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/20",
].join(" ");

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        inputBase,
        "h-9 px-3 py-1",
        "file:mr-3 file:inline-flex file:h-7 file:rounded-sm file:border-0 file:bg-secondary file:px-2 file:text-sm file:font-medium file:text-secondary-foreground",
        "[&::-webkit-search-cancel-button]:hidden",
        className,
      )}
      {...props}
    />
  );
}
