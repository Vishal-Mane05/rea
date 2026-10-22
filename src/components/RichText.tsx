"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { AiMenu } from "./ai/AiMenu";

interface Props {
  html: string;
  placeholder?: string;
  onChange: (html: string) => void;
}

export function RichText({ html, placeholder = "Start typing…", onChange }: Props) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, link: false }), Placeholder.configure({ placeholder })],
    content: html,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { class: "lf-prose" } },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
  });

  return (
    <div className="group/rt">
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (label: string, active: boolean, run: () => void, title: string) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
      className={`rounded px-2 py-0.5 text-xs ${active ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
    >
      {label}
    </button>
  );
  const chain = () => editor.chain().focus();
  return (
    <div className="mb-2 flex flex-wrap gap-1 opacity-0 transition-opacity group-focus-within/rt:opacity-100">
      {btn("B", editor.isActive("bold"), () => chain().toggleBold().run(), "Bold")}
      {btn("I", editor.isActive("italic"), () => chain().toggleItalic().run(), "Italic")}
      {btn("H2", editor.isActive("heading", { level: 2 }), () => chain().toggleHeading({ level: 2 }).run(), "Heading")}
      {btn("H3", editor.isActive("heading", { level: 3 }), () => chain().toggleHeading({ level: 3 }).run(), "Subheading")}
      {btn("• List", editor.isActive("bulletList"), () => chain().toggleBulletList().run(), "Bullet list")}
      {btn("1. List", editor.isActive("orderedList"), () => chain().toggleOrderedList().run(), "Numbered list")}
      {btn("❝", editor.isActive("blockquote"), () => chain().toggleBlockquote().run(), "Quote")}
      <span className="mx-1 w-px self-stretch bg-slate-200" />
      <AiMenu editor={editor} />
    </div>
  );
}
