export type MemoMarkdownLineType = "paragraph" | "heading" | "checklist" | "bullet" | "numbered";

export interface MemoMarkdownLine {
  type: MemoMarkdownLineType;
  text: string;
  level?: 1 | 2 | 3;
  checked?: boolean;
  number?: number;
}

const escapeHtml = (value: string) => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
};

const renderInlineMarkdown = (value: string) => {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code class="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.88em]">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
};

export const parseMemoMarkdownLine = (line: string): MemoMarkdownLine => {
  const heading = line.match(/^(#{1,3})\s+(.*)$/);
  if (heading) {
    return {
      type: "heading",
      level: heading[1].length as 1 | 2 | 3,
      text: heading[2],
    };
  }

  const checklist = line.match(/^-\s+\[( |x|X)\]\s?(.*)$/);
  if (checklist) {
    return {
      type: "checklist",
      checked: checklist[1].toLowerCase() === "x",
      text: checklist[2],
    };
  }

  const bullet = line.match(/^[-*]\s+(.*)$/);
  if (bullet) {
    return { type: "bullet", text: bullet[1] };
  }

  const numbered = line.match(/^(\d+)\.\s+(.*)$/);
  if (numbered) {
    return {
      type: "numbered",
      number: Number(numbered[1]),
      text: numbered[2],
    };
  }

  return { type: "paragraph", text: line };
};

const renderTextSpan = (text: string) => {
  return `<span data-md-text>${renderInlineMarkdown(text)}</span>`;
};

export const renderMemoMarkdown = (markdown: string) => {
  const lines = markdown.split("\n");

  return lines.map((line) => {
    const parsed = parseMemoMarkdownLine(line);
    const empty = parsed.text.length === 0;

    if (parsed.type === "heading") {
      const sizeClass = parsed.level === 1 ? "text-[1.35em]" : parsed.level === 2 ? "text-[1.18em]" : "text-[1.05em]";
      return `<div data-md-type="heading" data-md-level="${parsed.level}" class="memo-md-line ${sizeClass} font-bold leading-snug">${empty ? "<br>" : renderTextSpan(parsed.text)}</div>`;
    }

    if (parsed.type === "checklist") {
      const checkedClass = parsed.checked ? "border-stone-700 bg-stone-800 after:absolute after:left-[5px] after:top-[1px] after:h-2.5 after:w-1.5 after:rotate-45 after:border-b-2 after:border-r-2 after:border-white" : "border-stone-500/70 bg-white/50";
      return `<div data-md-type="checklist" data-md-checked="${parsed.checked ? "true" : "false"}" class="memo-md-line flex items-start gap-2 leading-relaxed"><span data-md-checkbox contenteditable="false" class="relative mt-[0.32em] h-4 w-4 shrink-0 rounded border ${checkedClass}"></span>${empty ? '<span data-md-text><br></span>' : renderTextSpan(parsed.text)}</div>`;
    }

    if (parsed.type === "bullet") {
      return `<div data-md-type="bullet" class="memo-md-line flex items-start gap-2 leading-relaxed"><span contenteditable="false" class="mt-[0.48em] h-1.5 w-1.5 shrink-0 rounded-full bg-stone-700"></span>${empty ? '<span data-md-text><br></span>' : renderTextSpan(parsed.text)}</div>`;
    }

    if (parsed.type === "numbered") {
      return `<div data-md-type="numbered" data-md-number="${parsed.number ?? 1}" class="memo-md-line flex items-start gap-2 leading-relaxed"><span contenteditable="false" class="shrink-0 font-semibold text-stone-600">${parsed.number ?? 1}.</span>${empty ? '<span data-md-text><br></span>' : renderTextSpan(parsed.text)}</div>`;
    }

    return `<div data-md-type="paragraph" class="memo-md-line leading-relaxed">${empty ? "<br>" : renderTextSpan(parsed.text)}</div>`;
  }).join("");
};

export const getMemoMarkdownPrefix = (line: MemoMarkdownLine) => {
  if (line.type === "heading") return `${"#".repeat(line.level ?? 1)} `;
  if (line.type === "checklist") return `- [${line.checked ? "x" : " "}] `;
  if (line.type === "bullet") return "- ";
  if (line.type === "numbered") return `${line.number ?? 1}. `;
  return "";
};

export const getMemoMarkdownShortcut = (textBeforeSpace: string) => {
  const text = textBeforeSpace.replace(/\u00a0/g, " ").trim();

  if (/^#{1,3}$/.test(text)) return `${text} `;
  if (text === "*" || text === "-") return "- ";
  if (/^\d+\.$/.test(text)) return `${Number.parseInt(text, 10)}. `;
  if (text === "[]" || text === "[ ]" || text === "-[]" || text === "-[ ]" || text === "- [ ]") return "- [ ] ";

  return null;
};
