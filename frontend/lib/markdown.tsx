"use client";

import React from "react";

/**
 * Dependency-free markdown renderer for AI chat output.
 *
 * We avoid an external markdown library because the ESM packages did not render
 * reliably in this Next/Turbopack runtime. Supports:
 *   - blocks:  # headings (1-4), --- hr, - / * / 1. lists, ``` code fences,
 *              > blockquote, blank-line paragraphs (single newline -> <br>)
 *   - inline:  **bold** __bold__, *italic* _italic_, `code`, [text](url)
 */

// Inline tokens tried in priority order per position.
const INLINE_RE =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]]+\]\([^)\s]+\))/;

/** Only allow safe link schemes — blocks javascript:/data: etc. (XSS). */
function safeHref(url: string): string {
  return /^(https?:|mailto:|\/|#)/i.test(url.trim()) ? url : "#";
}

export function renderInline(text: string, baseKey: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let rest = text;
  let n = 0;
  while (rest.length) {
    const m = INLINE_RE.exec(rest);
    if (!m) { out.push(rest); break; }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const tok = m[0];
    const key = `${baseKey}-${n++}`;
    if (tok.startsWith("`")) {
      out.push(<code key={key}>{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("**") || tok.startsWith("__")) {
      out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("[")) {
      const mm = /\[([^\]]+)\]\(([^)\s]+)\)/.exec(tok)!;
      out.push(
        <a key={key} href={safeHref(mm[2])} target="_blank" rel="noreferrer noopener">{mm[1]}</a>
      );
    } else {
      // *italic* or _italic_
      out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    }
    rest = rest.slice(m.index + tok.length);
  }
  return out;
}

function Heading({ level, children }: { level: number; children: React.ReactNode }) {
  if (level <= 1) return <h1>{children}</h1>;
  if (level === 2) return <h2>{children}</h2>;
  if (level === 3) return <h3>{children}</h3>;
  return <h4>{children}</h4>;
}

const RE_FENCE = /^```/;
const RE_HR = /^\s*(---|\*\*\*|___)\s*$/;
const RE_HEAD = /^(#{1,4})\s+(.*)$/;
const RE_QUOTE = /^\s*>\s?/;
const RE_LIST = /^\s*([-*+]|\d+\.)\s+/;

export function MarkdownText({ text }: { text: string }) {
  const lines = (text ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let k = 0;

  const isBlockStart = (l: string) =>
    RE_FENCE.test(l.trim()) || RE_HR.test(l) || RE_HEAD.test(l) ||
    RE_QUOTE.test(l) || RE_LIST.test(l);

  while (i < lines.length) {
    const line = lines[i];

    if (RE_FENCE.test(line.trim())) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !RE_FENCE.test(lines[i].trim())) { code.push(lines[i]); i++; }
      i++; // skip closing fence
      blocks.push(<pre key={k++}><code>{code.join("\n")}</code></pre>);
      continue;
    }
    if (line.trim() === "") { i++; continue; }
    if (RE_HR.test(line)) { blocks.push(<hr key={k++} />); i++; continue; }

    const h = RE_HEAD.exec(line);
    if (h) {
      blocks.push(<Heading key={k++} level={h[1].length}>{renderInline(h[2], `h${k}`)}</Heading>);
      i++; continue;
    }
    if (RE_QUOTE.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && RE_QUOTE.test(lines[i])) { quote.push(lines[i].replace(RE_QUOTE, "")); i++; }
      blocks.push(<blockquote key={k++}>{renderInline(quote.join(" "), `bq${k}`)}</blockquote>);
      continue;
    }
    if (RE_LIST.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: React.ReactNode[] = [];
      while (i < lines.length && RE_LIST.test(lines[i])) {
        const content = lines[i].replace(RE_LIST, "");
        items.push(<li key={items.length}>{renderInline(content, `li${k}-${items.length}`)}</li>);
        i++;
      }
      blocks.push(ordered ? <ol key={k++}>{items}</ol> : <ul key={k++}>{items}</ul>);
      continue;
    }

    // Paragraph — gather consecutive non-blank, non-block lines; single newline -> <br>.
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !isBlockStart(lines[i])) {
      para.push(lines[i]); i++;
    }
    const pnodes: React.ReactNode[] = [];
    para.forEach((pl, idx) => {
      if (idx > 0) pnodes.push(<br key={`br${k}-${idx}`} />);
      pnodes.push(...renderInline(pl, `p${k}-${idx}`));
    });
    blocks.push(<p key={k++}>{pnodes}</p>);
  }

  return <div className="md-msg">{blocks}</div>;
}
