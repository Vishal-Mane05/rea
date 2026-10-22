// Allowlist sanitizer for model-written HTML. Keeps a small set of formatting tags
// without attributes; everything else is dropped (its text is kept, except for
// script-like elements which are removed with their content).

const allowed = new Set(["p", "h2", "h3", "ul", "ol", "li", "strong", "em", "blockquote", "br"]);
const aliases: Record<string, string> = { b: "strong", i: "em", h1: "h2", h4: "h3", h5: "h3", h6: "h3" };
const dropWithContent = /<(script|style|iframe|object|embed|template|noscript|svg|math)\b[\s\S]*?<\/\1\s*>/gi;

export function sanitizeHtml(html: string): string {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(dropWithContent, "")
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (tag, rawName: string) => {
      const name = aliases[rawName.toLowerCase()] ?? rawName.toLowerCase();
      if (!allowed.has(name)) return "";
      if (name === "br") return "<br>";
      return tag.startsWith("</") ? `</${name}>` : `<${name}>`;
    })
    // stray angle brackets left in text must not start new tags
    .replace(/<(?!\/?(p|h2|h3|ul|ol|li|strong|em|blockquote|br)>)/g, "&lt;")
    .trim();
  return cleaned;
}

/** Plain text of (sanitized or raw) HTML, for prompts. */
export function htmlToText(html: string): string {
  return html
    .replace(dropWithContent, "")
    .replace(/<\/(p|h2|h3|li|blockquote)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
