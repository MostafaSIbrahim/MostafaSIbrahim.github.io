import { h } from './dom';

/**
 * A deliberately small TypeScript highlighter: one regex, six token kinds.
 * Returns one <span class="code-line"> per source line, so lines can be numbered and animated.
 */
const TOKEN =
  /(?<comment>\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(?<string>'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|\b(?<keyword>import|from|export|const|let|function|return|if|else|for|while|true|false|async|await|new|type|interface|void|typeof|try|catch|of|in)\b|\b(?<number>\d+(?:\.\d+)?)\b|\b(?<type>[A-Z][A-Za-z0-9]*)\b|\b(?<fn>[a-zA-Z_$][\w$]*)(?=\()/g;

interface Token {
  kind: string | null;
  text: string;
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const match of source.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) tokens.push({ kind: null, text: source.slice(last, index) });
    const kind = Object.entries(match.groups ?? {}).find(([, v]) => v !== undefined)?.[0] ?? null;
    tokens.push({ kind, text: match[0] });
    last = index + match[0].length;
  }
  if (last < source.length) tokens.push({ kind: null, text: source.slice(last) });
  return tokens;
}

export function highlight(source: string): HTMLSpanElement[] {
  const lines: HTMLSpanElement[] = [h('span', { class: 'code-line' })];

  for (const token of tokenize(source)) {
    // A token may span lines (block comments, template strings): split it.
    token.text.split('\n').forEach((part, i) => {
      if (i > 0) lines.push(h('span', { class: 'code-line' }));
      if (!part) return;
      const line = lines[lines.length - 1];
      line?.append(token.kind ? h('span', { class: `tok-${token.kind}` }, part) : part);
    });
  }
  return lines;
}
