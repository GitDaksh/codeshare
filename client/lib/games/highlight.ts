// A small syntax highlighter for the code in games (JavaScript, TypeScript
// and Python): enough to color keywords, strings, numbers, comments, calls
// and types the way the editor does, without loading the editor.

export type TokenKind = "text" | "keyword" | "string" | "number" | "type" | "comment" | "punct";
export type Token = { text: string; kind: TokenKind };
export type CodeLanguage = "javascript" | "typescript" | "python";

const JS_KEYWORDS = new Set(
  "const let var function return if else for while do break continue new class extends super this of in typeof instanceof await async yield throw try catch finally switch case default delete void import export from as null undefined true false static get set private public protected readonly interface type enum implements keyof declare namespace".split(
    " "
  )
);
const PY_KEYWORDS = new Set(
  "def return if elif else for while break continue class import from as with try except finally raise lambda yield in is not and or pass global nonlocal assert del None True False self async await".split(" ")
);

const TOKEN = /(\/\/[^\n]*|#[^\n]*)|(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\d[\w.]*)|([A-Za-z_$][\w$]*)|(\s+)|([^\s\w$])/g;

export function tokenize(code: string, language: CodeLanguage): Token[] {
  const keywords = language === "python" ? PY_KEYWORDS : JS_KEYWORDS;
  const tokens: Token[] = [];
  const isComment = (text: string) => (language === "python" ? text.startsWith("#") : text.startsWith("//"));
  let match: RegExpExecArray | null;
  let end = 0;
  TOKEN.lastIndex = 0;
  while ((match = TOKEN.exec(code))) {
    // Anything the patterns skipped stays in, as plain text.
    if (match.index > end) tokens.push({ text: code.slice(end, match.index), kind: "text" });
    const [text, comment, string, number, word, space] = match;
    end = match.index + text.length;
    if (comment !== undefined) {
      if (isComment(comment)) tokens.push({ text, kind: "comment" });
      else {
        // "#" in JavaScript is a private field marker, "//" in Python is division.
        tokens.push({ text: text[0], kind: "punct" });
        TOKEN.lastIndex = match.index + 1;
        end = match.index + 1;
      }
    } else if (string !== undefined) tokens.push({ text, kind: "string" });
    else if (number !== undefined) tokens.push({ text, kind: "number" });
    else if (word !== undefined) {
      const next = code[match.index + text.length];
      if (keywords.has(word)) tokens.push({ text, kind: "keyword" });
      else if (next === "(") tokens.push({ text, kind: "type" });
      else if (/^[A-Z]/.test(word)) tokens.push({ text, kind: "type" });
      else tokens.push({ text, kind: "text" });
    } else if (space !== undefined) tokens.push({ text, kind: "text" });
    else tokens.push({ text, kind: "punct" });
  }
  if (end < code.length) tokens.push({ text: code.slice(end), kind: "text" });
  return tokens;
}

// The token kind of every character, for drawing code one character at a time.
export function charKinds(code: string, language: CodeLanguage): TokenKind[] {
  const kinds: TokenKind[] = [];
  for (const token of tokenize(code, language)) for (let i = 0; i < token.text.length; i++) kinds.push(token.kind);
  return kinds;
}

export const KIND_CLASS: Record<TokenKind, string> = {
  text: "syn-text",
  keyword: "syn-keyword",
  string: "syn-string",
  number: "syn-number",
  type: "syn-type",
  comment: "syn-comment",
  punct: "syn-punct",
};
