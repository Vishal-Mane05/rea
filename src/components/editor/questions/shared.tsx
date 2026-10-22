"use client";

import * as React from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Modifier } from "@dnd-kit/core";
import { AlertTriangle, ChevronDown, GripVertical, Info, MessageSquareText, Plus, Trash2 } from "lucide-react";
import { BlockCanvas } from "@/components/editor";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const newId = () => crypto.randomUUID();

export const SURVEY_TOOLTIP = "Questions in survey mode collect responses only — they have no correct or incorrect answers.";

// ---------------------------------------------------------------------------------------------
// Tooltip wrapper that also works for disabled controls (disabled elements swallow pointer events).
// ---------------------------------------------------------------------------------------------
export function Hint({ content, children, disabled, side = "top" }: { content?: React.ReactNode; children: React.ReactElement; disabled?: boolean; side?: "top" | "bottom" | "left" | "right" }) {
  if (!content) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {disabled ? (
          <span tabIndex={0} className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {children}
          </span>
        ) : (
          children
        )}
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-64 text-pretty">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

/** Delete button that is disabled (with explanation) when removing would break the minimum count. */
export function GuardedDeleteButton({
  canDelete,
  minMessage,
  label,
  onDelete,
  className,
}: {
  canDelete: boolean;
  minMessage: string;
  label: string;
  onDelete: () => void;
  className?: string;
}) {
  return (
    <Hint content={canDelete ? label : minMessage} disabled={!canDelete}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        disabled={!canDelete}
        onClick={onDelete}
        className={cn("size-8 shrink-0 text-muted-foreground hover:text-destructive", className)}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </Hint>
  );
}

export function AddItemButton({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={disabled} className="gap-1.5 border-dashed">
      <Plus className="size-4" aria-hidden />
      {children}
    </Button>
  );
}

export function FieldNote({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" }) {
  const Icon = tone === "warn" ? AlertTriangle : Info;
  return (
    <p className={cn("flex items-start gap-1.5 text-xs leading-relaxed", tone === "warn" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
      <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function ShuffleNote({ what = "answer options" }: { what?: string }) {
  return <FieldNote>Drag to reorder. When “Shuffle answer options” is on in course settings, learners see the {what} in a random order.</FieldNote>;
}

export function SectionLabel({ children, htmlFor, aside }: { children: React.ReactNode; htmlFor?: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {children}
      </label>
      {aside}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Sortable list (dnd-kit) with an accessible drag handle (Space/Enter to lift, arrows to move).
// ---------------------------------------------------------------------------------------------
export interface DragHandleProps {
  attributes: React.HTMLAttributes<HTMLElement>;
  listeners: Record<string, unknown> | undefined;
  setActivatorNodeRef: (el: HTMLElement | null) => void;
}

export function DragHandle({ handle, label }: { handle: DragHandleProps; label: string }) {
  return (
    <button
      type="button"
      ref={handle.setActivatorNodeRef}
      {...handle.attributes}
      {...(handle.listeners as React.HTMLAttributes<HTMLButtonElement>)}
      aria-label={label}
      className="flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
    >
      <GripVertical className="size-4" aria-hidden />
    </button>
  );
}

function SortableRow({ id, children, className }: { id: string; className?: string; children: (handle: DragHandleProps, dragging: boolean) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("relative list-none", isDragging && "z-10 opacity-90 shadow-lg", className)}
    >
      {children({ attributes: attributes as unknown as React.HTMLAttributes<HTMLElement>, listeners, setActivatorNodeRef }, isDragging)}
    </li>
  );
}

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  layout = "list",
  className,
  itemClassName,
  label,
}: {
  items: T[];
  onReorder: (next: T[]) => void;
  renderItem: (item: T, index: number, handle: DragHandleProps, dragging: boolean) => React.ReactNode;
  layout?: "list" | "grid";
  className?: string;
  itemClassName?: string;
  label: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to));
  };
  const textOf = (id: unknown) => {
    const idx = items.findIndex((i) => i.id === id);
    return idx >= 0 ? `item ${idx + 1}` : "item";
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      modifiers={layout === "list" ? [restrictToVerticalAxis] : undefined}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up ${textOf(active.id)}.`,
          onDragOver: ({ active, over }) => (over ? `${textOf(active.id)} is over position ${items.findIndex((i) => i.id === over.id) + 1}.` : `${textOf(active.id)} is no longer over a position.`),
          onDragEnd: ({ active, over }) => (over ? `Dropped ${textOf(active.id)} at position ${items.findIndex((i) => i.id === over.id) + 1}.` : `Dropped ${textOf(active.id)}.`),
          onDragCancel: ({ active }) => `Cancelled moving ${textOf(active.id)}.`,
        },
      }}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={layout === "grid" ? rectSortingStrategy : verticalListSortingStrategy}>
        <ul aria-label={label} className={cn(layout === "grid" ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-2", className)}>
          {items.map((item, index) => (
            <SortableRow key={item.id} id={item.id} className={itemClassName}>
              {(handle, dragging) => renderItem(item, index, handle, dragging)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

// ---------------------------------------------------------------------------------------------
// Per-answer explanation canvas (only when feedback mode = per answer).
// ---------------------------------------------------------------------------------------------
export function ExplanationToggle({ pageId, answerKey, label }: { pageId: string; answerKey: string; label: string }) {
  const [open, setOpen] = React.useState(false);
  const regionId = React.useId();
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={regionId}
        className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MessageSquareText className="size-3.5" aria-hidden />
        {open ? "Hide explanation" : "Explanation"}
        <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div id={regionId} role="region" aria-label={label} className="mt-2 rounded-md border border-dashed bg-muted/30 p-2">
          <BlockCanvas pageId={pageId} slot="EXPLANATION" answerKey={answerKey} compact />
        </div>
      )}
    </div>
  );
}

/** Correctness controls are disabled in survey mode — this wraps them with the explanation. */
export function SurveyLock({ survey, children }: { survey: boolean; children: React.ReactElement }) {
  return (
    <Hint content={survey ? SURVEY_TOOLTIP : undefined} disabled={survey}>
      {children}
    </Hint>
  );
}

export function useAutoFocusId() {
  const [focusId, setFocusId] = React.useState<string | null>(null);
  const ref = React.useCallback(
    (id: string) => (el: HTMLInputElement | HTMLTextAreaElement | null) => {
      if (el && id === focusId) {
        el.focus();
        setFocusId(null);
      }
    },
    [focusId],
  );
  return { focusRef: ref, requestFocus: setFocusId };
}

export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export const round2 = (v: number) => Math.round(v * 100) / 100;

/** Lock list dragging to the vertical axis (avoids pulling in @dnd-kit/modifiers for one helper). */
const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });
