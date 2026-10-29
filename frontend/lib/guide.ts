import fs from "node:fs";
import path from "node:path";

/** One card of the guide: see the format described at the top of content/guide.md. */
export interface GuideSection {
  id: string;
  emoji: string;
  title: string;
  summary: string;
  why: string;
  steps: string[];
  tip: string;
  link: { label: string; href: string } | null;
}

export interface Guide {
  title: string;
  intro: string;
  sections: GuideSection[];
}

const EMOJI = /^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*/u;

function slug(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseSection(block: string): GuideSection {
  const [heading, ...lines] = block.split("\n");
  const emoji = EMOJI.exec(heading.trim())?.[1] ?? "";
  const title = heading.trim().replace(EMOJI, "");
  const section: GuideSection = {
    id: slug(title),
    emoji,
    title,
    summary: "",
    why: "",
    steps: [],
    tip: "",
    link: null,
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line === "**Comment :**") continue;
    if (line.startsWith(">")) section.summary = line.slice(1).trim();
    else if (line.startsWith("**Pourquoi :**")) section.why = line.slice(14).trim();
    else if (/^\d+\.\s/.test(line)) section.steps.push(line.replace(/^\d+\.\s/, ""));
    else if (line.startsWith("💡")) section.tip = line.slice(2).trim();
    else {
      const link = /^\[(.+)\]\((\/[^)]*)\)$/.exec(line);
      if (link) section.link = { label: link[1], href: link[2] };
    }
  }
  return section;
}

/** Read and parse content/guide.md (at build time: the guide page is static). */
export function loadGuide(): Guide {
  const file = path.join(process.cwd(), "content", "guide.md");
  const text = fs
    .readFileSync(file, "utf8")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\r/g, "");
  const [head, ...blocks] = text.split(/^## /m);
  const title = /^# (.+)$/m.exec(head)?.[1].trim() ?? "Guide";
  const intro = head
    .replace(/^# .+$/m, "")
    .trim()
    .split("\n")
    .join(" ");
  return { title, intro, sections: blocks.map(parseSection) };
}
