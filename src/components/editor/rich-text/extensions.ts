import type { AnyExtension, Extensions } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TextAlign from "@tiptap/extension-text-align";
import { TableKit, TableCell, TableHeader } from "@tiptap/extension-table";
import { Placeholder, CharacterCount } from "@tiptap/extensions";

export type ToolbarVariant = "full" | "inline" | "minimal";

/** Adds a `backgroundColor` attribute to table cells (cell properties in the table toolbar). */
const cellBackground = {
  backgroundColor: {
    default: null as string | null,
    parseHTML: (el: HTMLElement) => el.style.backgroundColor || el.getAttribute("data-background-color") || null,
    renderHTML: (attrs: Record<string, unknown>) =>
      attrs.backgroundColor ? { style: `background-color: ${String(attrs.backgroundColor)}` } : {},
  },
};

const ColoredCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellBackground };
  },
});
const ColoredHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellBackground };
  },
});

export const FONT_SIZES = ["10px", "12px", "14px", "16px", "18px", "24px", "30px", "36px"] as const;

/** Build the TipTap extension list for a RichText instance. */
export function buildExtensions(opts: { placeholder: string; variant: ToolbarVariant; extra?: Extensions; singleLine?: boolean }): Extensions {
  const minimal = opts.variant === "minimal";
  const list: AnyExtension[] = [
    StarterKit.configure({
      heading: minimal ? false : { levels: [1, 2, 3, 4] },
      codeBlock: false,
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer nofollow" },
      },
    }),
    TextStyleKit.configure({ fontFamily: false, lineHeight: false }),
    Highlight.configure({ multicolor: true }),
    Subscript,
    Superscript,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Placeholder.configure({ placeholder: opts.placeholder, showOnlyCurrent: false }),
    CharacterCount,
  ];
  if (!minimal) {
    list.push(
      TableKit.configure({ table: { resizable: false, HTMLAttributes: { class: "lf-table" } }, tableCell: false, tableHeader: false }),
      ColoredCell,
      ColoredHeader,
    );
  }
  return [...list, ...(opts.extra ?? [])];
}
