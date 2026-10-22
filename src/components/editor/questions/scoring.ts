// Learner-side scoring used by the editor's "learner preview". Mirrors ai-and-player.md §E6:
// every question is all-or-nothing.
import type { QuestionDataOf } from "@lf/schema";

type Opt = { id: string; isCorrect: boolean };

export function scoreChoice(options: Opt[], selected: string[]): boolean {
  const correct = new Set(options.filter((o) => o.isCorrect).map((o) => o.id));
  if (selected.length !== correct.size) return false;
  return selected.every((id) => correct.has(id));
}

export function scoreStatements(statements: QuestionDataOf<"statement">["statements"], answers: Record<string, boolean | undefined>): boolean {
  return statements.every((s) => answers[s.id] === s.isTrue);
}

export function scoreRanking(items: { id: string }[], order: string[]): boolean {
  return items.length === order.length && items.every((it, i) => it.id === order[i]);
}

export function gapIsCorrect(gap: QuestionDataOf<"fillInTheBlanks">["gaps"][number], value: string | undefined): boolean {
  const v = (value ?? "").trim();
  if (gap.kind === "dropdown") return gap.options.some((o) => o.isCorrect && o.id === v);
  if (!v) return false;
  return gap.answers.some((a) => (gap.matchCase ? a.trim() === v : a.trim().toLowerCase() === v.toLowerCase()));
}

export function scoreFillInTheBlanks(data: QuestionDataOf<"fillInTheBlanks">, values: Record<string, string>): boolean {
  return data.gaps.every((g) => gapIsCorrect(g, values[g.id]));
}

export function scoreTextMatching(pairs: QuestionDataOf<"textMatching">["pairs"], chosen: Record<string, string>): boolean {
  // chosen: pairId(term) -> pairId(of the selected match). Pairs with identical match text are interchangeable.
  return pairs.every((p) => {
    const pick = pairs.find((q) => q.id === chosen[p.id]);
    return !!pick && pick.match.trim() === p.match.trim();
  });
}

export function scoreDragAndDrop(spots: QuestionDataOf<"dragAndDropText">["spots"], placed: Record<string, string | undefined>): boolean {
  // placed: spotId -> id of the spot whose text was dropped there. Same text counts as equal.
  return spots.every((s) => {
    const src = spots.find((x) => x.id === placed[s.id]);
    return !!src && src.text.trim() === s.text.trim();
  });
}

export function pointInArea(p: { x: number; y: number }, a: { x: number; y: number; width: number; height: number }) {
  return p.x >= a.x && p.x <= a.x + a.width && p.y >= a.y && p.y <= a.y + a.height;
}

export function scoreHotspot(data: QuestionDataOf<"hotspot">, markers: { x: number; y: number }[]): boolean {
  if (data.areas.length === 0) return true;
  if (markers.length === 0) return false;
  const allInside = markers.every((m) => data.areas.some((a) => pointInArea(m, a)));
  if (!allInside) return false;
  if (data.mode === "single") return true;
  return data.areas.every((a) => markers.some((m) => pointInArea(m, a)));
}

/** Deterministic shuffle so previews don't reshuffle on every render. */
export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = arr.slice();
  let s = seed || 1;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
