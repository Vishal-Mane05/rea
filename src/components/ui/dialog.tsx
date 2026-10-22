"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

export function DialogTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

export function DialogPortal(props: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

export function DialogClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

export function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-in-fade data-[state=closed]:animate-out-fade",
        className,
      )}
      {...props}
    />
  );
}

const dialogSizes = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-[min(calc(100vw-2rem),80rem)] h-[calc(100dvh-2rem)]",
} as const;

export interface DialogContentProps extends React.ComponentProps<typeof DialogPrimitive.Content> {
  /** Hide the top-right close button. */
  showCloseButton?: boolean;
  /** Width preset (default `md`). */
  size?: keyof typeof dialogSizes;
}

export function DialogContent({ className, children, showCloseButton = true, size = "md", ...props }: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4",
          "rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-xl outline-none",
          "data-[state=open]:animate-in-zoom data-[state=closed]:animate-out-zoom",
          dialogSizes[size],
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className={cn(
              "absolute top-4 right-4 grid size-8 place-items-center rounded-md text-muted-foreground transition-colors",
              "hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              "disabled:pointer-events-none",
            )}
          >
            <XIcon className="size-4" aria-hidden />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-1.5 pr-8 text-left", className)} {...props} />;
}

export function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-body" className={cn("-mx-6 min-h-0 flex-1 overflow-y-auto px-6", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end", className)}
      {...props}
    />
  );
}

export function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-tight font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

export function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}
