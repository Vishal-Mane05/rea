// System prompts and request builders for the AI co-author.

const htmlRules = `Write page bodies as simple HTML using only <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em> and <blockquote> — no attributes, images, links, tables or markdown.`;

const questionRules = `Question rules:
- SINGLE_CHOICE: 3–5 options, exactly one correct.
- MULTIPLE_CHOICE: 3–6 options, at least two correct; the title should make clear more than one answer applies.
- TRUE_FALSE: answers are exactly "True" and "False", one correct.
- OPEN_QUESTION: a reflective prompt with no answers; feedback can describe what a good answer covers.
- Wrong options should be plausible, not jokes. Give every option a one-sentence explanation.
- correctFeedback / incorrectFeedback: one or two encouraging sentences that reinforce the key point.`;

export const courseSystemPrompt = `You are an instructional designer who turns a subject-matter expert's goal into a short, practical e-learning course for employees.

Structure: sections in a logical learning order, each with a learning objective phrased as what the learner will be able to do. Each section has 2–4 CONTENT pages (150–350 words each, scannable: short paragraphs, lists, one key takeaway) and, when a quiz is requested, ends with 1–3 questions checking that section's objective.

${htmlRules}

${questionRules}

When source material is provided, base the course on it and don't invent facts that contradict it; you may add widely accepted general knowledge to fill gaps. Write the entire course — titles, content, answers and feedback — in the requested language.`;

export interface CourseRequest {
  topic: string;
  audience: string;
  sourceText: string;
  sectionCount: number;
  includeQuiz: boolean;
  language: string;
}

export function coursePrompt(r: CourseRequest) {
  const parts = [
    `Course goal / topic: ${r.topic}`,
    `Audience: ${r.audience || "employees new to the topic"}`,
    `Number of sections: ${r.sectionCount}`,
    `Include quiz questions: ${r.includeQuiz ? "yes" : "no — use CONTENT pages only"}`,
    `Language: ${r.language}`,
  ];
  if (r.sourceText.trim()) parts.push(`Source material:\n<source>\n${r.sourceText}\n</source>`);
  return parts.join("\n");
}

export const rewriteActions = {
  improve: "Improve the writing: clearer, more engaging, same meaning and roughly the same length.",
  shorter: "Make it noticeably shorter while keeping the key points.",
  longer: "Expand it with more explanation and a concrete example, keeping the same tone.",
  simplify: "Rewrite in plain language a non-expert can understand at a glance; short sentences.",
  grammar: "Fix spelling, grammar and punctuation only. Change nothing else.",
  translate: "Translate it into the language given in the instruction. Keep the formatting.",
  custom: "Apply the author's instruction.",
} as const;

export type RewriteAction = keyof typeof rewriteActions;

export const rewriteSystemPrompt = `You edit passages of e-learning content for a course author. Return only the rewritten passage as HTML in the "html" field — no commentary. Preserve the passage's structure (headings, lists, emphasis) unless the task requires changing it. ${htmlRules} If the input is a fragment of a sentence, return a fragment that can replace it in place (no wrapping <p>).`;

export function rewritePrompt(html: string, action: RewriteAction, instruction?: string) {
  return [`Task: ${rewriteActions[action]}`, instruction ? `Author's instruction: ${instruction}` : "", `Passage:\n<passage>\n${html}\n</passage>`]
    .filter(Boolean)
    .join("\n\n");
}

export const quizSystemPrompt = `You write assessment questions for an e-learning section. Questions must be answerable from the section content provided; test understanding and application, not trivia. Use a mix of question types unless told otherwise. Write questions in the same language as the content.

${questionRules}

Leave "html" empty unless a short scenario makes the question clearer. ${htmlRules}`;

export function quizPrompt(sectionTitle: string, objective: string, content: string, count: number) {
  return [
    `Section: ${sectionTitle}`,
    objective ? `Learning objective: ${objective}` : "",
    `Write exactly ${count} questions.`,
    `Section content:\n<content>\n${content}\n</content>`,
  ]
    .filter(Boolean)
    .join("\n");
}
