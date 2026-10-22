import type { PageType } from "@prisma/client";
import { db } from "./db";
import { defaultSettings, type CourseSettings } from "../../../player/src/format";

interface TemplatePage {
  type: PageType;
  title: string;
  html?: string;
  answers?: { text: string; isCorrect: boolean }[];
}

interface TemplateSection {
  title: string;
  learningObjective?: string;
  pages: TemplatePage[];
}

export interface CourseTemplate {
  key: string;
  name: string;
  description: string;
  emoji: string;
  settings?: Partial<CourseSettings>;
  sections: TemplateSection[];
}

export const templates: CourseTemplate[] = [
  {
    key: "blank",
    name: "Start from scratch",
    description: "An empty course with one section, ready for your content.",
    emoji: "✏️",
    sections: [{ title: "Untitled section", pages: [{ type: "CONTENT", title: "Untitled page", html: "" }] }],
  },
  {
    key: "onboarding",
    name: "Employee onboarding",
    description: "Welcome new hires: company intro, tools, people and a short check.",
    emoji: "👋",
    sections: [
      {
        title: "Welcome aboard",
        learningObjective: "Know who we are and what we do",
        pages: [
          { type: "CONTENT", title: "Our story", html: "<p>Tell new colleagues how the company started and where it is heading.</p>" },
          { type: "CONTENT", title: "Our values", html: "<ul><li><p>Value one</p></li><li><p>Value two</p></li><li><p>Value three</p></li></ul>" },
        ],
      },
      {
        title: "Your first week",
        learningObjective: "Get set up with tools and people",
        pages: [
          { type: "CONTENT", title: "Tools you will use", html: "<p>List the systems, logins and where to get help.</p>" },
          {
            type: "SINGLE_CHOICE",
            title: "Who do you contact for IT access?",
            answers: [
              { text: "The IT service desk", isCorrect: true },
              { text: "Your neighbour", isCorrect: false },
              { text: "Nobody, figure it out", isCorrect: false },
            ],
          },
        ],
      },
    ],
  },
  {
    key: "compliance",
    name: "Compliance quiz",
    description: "Policy summary followed by a scored assessment with a pass mark.",
    emoji: "🛡️",
    settings: { passingScore: 80, allowRetry: true },
    sections: [
      {
        title: "Policy essentials",
        learningObjective: "Understand the key rules",
        pages: [{ type: "CONTENT", title: "Summary of the policy", html: "<p>Summarise the policy in plain language.</p>" }],
      },
      {
        title: "Assessment",
        learningObjective: "Prove you know the rules",
        pages: [
          {
            type: "TRUE_FALSE",
            title: "It is fine to share your password with a colleague you trust.",
            answers: [
              { text: "True", isCorrect: false },
              { text: "False", isCorrect: true },
            ],
          },
          {
            type: "MULTIPLE_CHOICE",
            title: "Which of these are signs of a phishing email?",
            answers: [
              { text: "Urgent request to click a link", isCorrect: true },
              { text: "Sender address that doesn't match the company", isCorrect: true },
              { text: "Email from your manager about the team lunch", isCorrect: false },
            ],
          },
        ],
      },
    ],
  },
  {
    key: "product",
    name: "Product training",
    description: "Explain a product's features and benefits, then check understanding.",
    emoji: "📦",
    sections: [
      {
        title: "Meet the product",
        pages: [
          { type: "CONTENT", title: "What it does", html: "<p>Describe the problem the product solves.</p>" },
          { type: "CONTENT", title: "Key features", html: "<ol><li><p>Feature one</p></li><li><p>Feature two</p></li></ol>" },
        ],
      },
      {
        title: "Check your knowledge",
        pages: [{ type: "OPEN_QUESTION", title: "How would you pitch the product to a new customer in one sentence?" }],
      },
    ],
  },
];

export async function createCourseFromTemplate(ownerId: string, templateKey: string, title?: string) {
  const template = templates.find((t) => t.key === templateKey) ?? templates[0];
  return db.course.create({
    data: {
      ownerId,
      title: title?.trim() || (template.key === "blank" ? "Untitled course" : template.name),
      templateKey: template.key,
      settings: { ...defaultSettings, ...template.settings },
      sections: {
        create: template.sections.map((s, si) => ({
          title: s.title,
          learningObjective: s.learningObjective ?? "",
          position: si,
          pages: {
            create: s.pages.map((p, pi) => ({
              type: p.type,
              title: p.title,
              position: pi,
              blocks: p.html !== undefined ? { create: [{ type: "TEXT", position: 0, html: p.html }] } : undefined,
              answers: p.answers ? { create: p.answers.map((a, ai) => ({ ...a, position: ai })) } : undefined,
            })),
          },
        })),
      },
    },
  });
}
