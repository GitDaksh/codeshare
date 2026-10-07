import type { Monaco } from "@monaco-editor/react";
// Every editor defines its themes from here, so this is also where the
// pinned Monaco version is set (see lib/monaco.ts).
import "@/lib/monaco";

type ThemeData = Parameters<Monaco["editor"]["defineTheme"]>[1];

// Token colors are 6-digit hex without "#" (Monaco's format for rules).
// `selection` is 8-digit hex (with alpha) because it's drawn over code.
type Palette = {
  foreground: string;
  keyword: string;
  keywordBold?: boolean;
  string: string;
  number: string;
  type: string;
  regexp: string;
  comment: string;
  delimiter: string;
  operator: string;
  cursor: string;
  selection: string;
  activeLineNumber: string;
};

export type EditorThemeOption = {
  id: string;
  label: string;
  description: string;
  swatches: string[];
  palette: Palette;
  // Light themes get light editor chrome (the dark ones keep the dark).
  light?: boolean;
};

// Monaco can't read CSS variables, so the editor chrome is set here directly.
// Each chrome's background equals --ink-900 of its app theme in globals.css,
// so the editor blends seamlessly into its panel.
type Chrome = {
  background: string;
  lineHighlight: string;
  widgetBackground: string;
  widgetBorder: string;
  lineNumber: string;
  indentGuide: string;
  activeIndentGuide: string;
  whitespace: string;
  selectedSuggestion: string;
  // The subtle overlays (find matches, bracket matches, scrollbars).
  overlay: string;
};

// Equals --ink-900 in the dark theme, so the editor blends into its panel.
const DARK_CHROME: Chrome = {
  background: "#1b1b1f",
  lineHighlight: "#222227",
  widgetBackground: "#202025",
  widgetBorder: "#36363d",
  lineNumber: "#4d4d55",
  indentGuide: "#27272c",
  activeIndentGuide: "#4d4d55",
  whitespace: "#3a3a41",
  selectedSuggestion: "#2c2c32",
  overlay: "ffffff",
};

const LIGHT_CHROME: Chrome = {
  background: "#ffffff",
  lineHighlight: "#f6f6f8",
  widgetBackground: "#ffffff",
  widgetBorder: "#dfdfe4",
  lineNumber: "#b4b4bc",
  indentGuide: "#efeff2",
  activeIndentGuide: "#c8c8cf",
  whitespace: "#d4d4da",
  selectedSuggestion: "#ececf0",
  overlay: "18181b",
};

export const EDITOR_THEMES: EditorThemeOption[] = [
  {
    id: "codeshare-dark",
    label: "CodeShare",
    description: "Soft tones that match the app",
    swatches: ["#ffffff", "#a6d19b", "#e3b77e", "#8fc6db"],
    palette: {
      foreground: "d4d4d4",
      keyword: "ffffff",
      keywordBold: true,
      string: "a6d19b",
      number: "e3b77e",
      type: "8fc6db",
      regexp: "d7a6d7",
      comment: "5f5f5f",
      delimiter: "8a8a8a",
      operator: "a3a3a3",
      cursor: "ffffff",
      selection: "ffffff26",
      activeLineNumber: "cfcfcf",
    },
  },
  {
    id: "codeshare-light",
    label: "CodeShare Light",
    description: "Crisp and readable, matches the app",
    swatches: ["#cf222e", "#0a3069", "#0550ae", "#8250df"],
    light: true,
    palette: {
      foreground: "1f2328",
      keyword: "cf222e",
      string: "0a3069",
      number: "0550ae",
      type: "8250df",
      regexp: "116329",
      comment: "6e7781",
      delimiter: "57606a",
      operator: "57606a",
      cursor: "18181b",
      selection: "0969da2e",
      activeLineNumber: "18181b",
    },
  },
  {
    id: "codeshare-paper",
    label: "Paper",
    description: "Quiet monochrome on white",
    swatches: ["#18181b", "#52525b", "#71717a", "#a1a1aa"],
    light: true,
    palette: {
      foreground: "27272a",
      keyword: "09090b",
      keywordBold: true,
      string: "52525b",
      number: "3f3f46",
      type: "18181b",
      regexp: "52525b",
      comment: "a1a1aa",
      delimiter: "71717a",
      operator: "71717a",
      cursor: "18181b",
      selection: "18181b1f",
      activeLineNumber: "18181b",
    },
  },
  {
    id: "codeshare-mono",
    label: "Mono",
    description: "Pure grayscale",
    swatches: ["#ffffff", "#d6d6d6", "#b0b0b0", "#555555"],
    palette: {
      foreground: "cfcfcf",
      keyword: "ffffff",
      keywordBold: true,
      string: "b0b0b0",
      number: "d6d6d6",
      type: "e6e6e6",
      regexp: "bdbdbd",
      comment: "555555",
      delimiter: "7a7a7a",
      operator: "9a9a9a",
      cursor: "ffffff",
      selection: "ffffff26",
      activeLineNumber: "e6e6e6",
    },
  },
  {
    id: "codeshare-midnight",
    label: "Midnight",
    description: "Classic, balanced colors",
    swatches: ["#c678dd", "#98c379", "#d19a66", "#e5c07b"],
    palette: {
      foreground: "abb2bf",
      keyword: "c678dd",
      string: "98c379",
      number: "d19a66",
      type: "e5c07b",
      regexp: "56b6c2",
      comment: "5c6370",
      delimiter: "8b93a1",
      operator: "56b6c2",
      cursor: "528bff",
      selection: "528bff33",
      activeLineNumber: "d7dae0",
    },
  },
  {
    id: "codeshare-glacier",
    label: "Glacier",
    description: "Cool, calm blues",
    swatches: ["#81a1c1", "#a3be8c", "#b48ead", "#8fbcbb"],
    palette: {
      foreground: "d8dee9",
      keyword: "81a1c1",
      string: "a3be8c",
      number: "b48ead",
      type: "8fbcbb",
      regexp: "ebcb8b",
      comment: "616e88",
      delimiter: "a7b1c2",
      operator: "81a1c1",
      cursor: "d8dee9",
      selection: "88c0d033",
      activeLineNumber: "eceff4",
    },
  },
  {
    id: "codeshare-ember",
    label: "Ember",
    description: "Warm rose and gold",
    swatches: ["#eb6f92", "#f6c177", "#ea9a97", "#9ccfd8"],
    palette: {
      foreground: "e0def4",
      keyword: "eb6f92",
      string: "f6c177",
      number: "ea9a97",
      type: "9ccfd8",
      regexp: "c4a7e7",
      comment: "6e6a86",
      delimiter: "908caa",
      operator: "ebbcba",
      cursor: "f6c177",
      selection: "f6c17733",
      activeLineNumber: "e0def4",
    },
  },
  {
    id: "codeshare-neon",
    label: "Neon",
    description: "Bright and vivid",
    swatches: ["#bb9af7", "#9ece6a", "#ff9e64", "#7dcfff"],
    palette: {
      foreground: "c0caf5",
      keyword: "bb9af7",
      string: "9ece6a",
      number: "ff9e64",
      type: "7dcfff",
      regexp: "b4f9f8",
      comment: "565f89",
      delimiter: "89ddff",
      operator: "89ddff",
      cursor: "c0caf5",
      selection: "7aa2f733",
      activeLineNumber: "c0caf5",
    },
  },
];

// Until you pick one, the editor follows the app's theme.
export const DEFAULT_EDITOR_THEME = "codeshare-dark";
export const DEFAULT_LIGHT_EDITOR_THEME = "codeshare-light";

export function isEditorTheme(id: string): boolean {
  return EDITOR_THEMES.some((theme) => theme.id === id);
}

function buildTheme(theme: EditorThemeOption): ThemeData {
  const p = theme.palette;
  const c = theme.light ? LIGHT_CHROME : DARK_CHROME;
  return {
    base: theme.light ? "vs" : "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: p.foreground },
      { token: "comment", foreground: p.comment, fontStyle: "italic" },
      { token: "comment.doc", foreground: p.comment, fontStyle: "italic" },
      { token: "keyword", foreground: p.keyword, ...(p.keywordBold ? { fontStyle: "bold" } : {}) },
      { token: "identifier", foreground: p.foreground },
      { token: "variable", foreground: p.foreground },
      { token: "variable.predefined", foreground: p.type },
      { token: "type", foreground: p.type },
      { token: "type.identifier", foreground: p.type },
      { token: "annotation", foreground: p.type },
      { token: "string", foreground: p.string },
      { token: "string.escape", foreground: p.regexp },
      { token: "number", foreground: p.number },
      { token: "number.float", foreground: p.number },
      { token: "number.hex", foreground: p.number },
      { token: "constant", foreground: p.number },
      { token: "regexp", foreground: p.regexp },
      { token: "delimiter", foreground: p.delimiter },
      { token: "delimiter.bracket", foreground: p.delimiter },
      { token: "operator", foreground: p.operator },
      { token: "tag", foreground: p.keyword },
      { token: "attribute.name", foreground: p.type },
      { token: "attribute.value", foreground: p.string },
    ],
    colors: {
      "editor.background": c.background,
      "editor.foreground": `#${p.foreground}`,
      "editorGutter.background": c.background,
      "editorLineNumber.foreground": c.lineNumber,
      "editorLineNumber.activeForeground": `#${p.activeLineNumber}`,
      "editor.lineHighlightBackground": c.lineHighlight,
      "editor.lineHighlightBorder": "#00000000",
      "editor.selectionBackground": `#${p.selection}`,
      "editor.inactiveSelectionBackground": `#${c.overlay}14`,
      "editor.selectionHighlightBackground": `#${c.overlay}12`,
      "editor.wordHighlightBackground": `#${c.overlay}10`,
      "editor.findMatchBackground": `#${c.overlay}33`,
      "editor.findMatchHighlightBackground": `#${c.overlay}1a`,
      "editorCursor.foreground": `#${p.cursor}`,
      "editorWhitespace.foreground": c.whitespace,
      "editorIndentGuide.background": c.indentGuide,
      "editorIndentGuide.activeBackground": c.activeIndentGuide,
      "editorIndentGuide.background1": c.indentGuide,
      "editorIndentGuide.activeBackground1": c.activeIndentGuide,
      "editorBracketMatch.background": `#${c.overlay}14`,
      "editorBracketMatch.border": `#${c.overlay}40`,
      "editorWidget.background": c.widgetBackground,
      "editorWidget.border": c.widgetBorder,
      "editorSuggestWidget.background": c.widgetBackground,
      "editorSuggestWidget.border": c.widgetBorder,
      "editorSuggestWidget.foreground": `#${p.foreground}`,
      "editorSuggestWidget.highlightForeground": `#${p.keyword}`,
      "editorSuggestWidget.selectedBackground": c.selectedSuggestion,
      "editorHoverWidget.background": c.widgetBackground,
      "editorHoverWidget.border": c.widgetBorder,
      "editorOverviewRuler.border": "#00000000",
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": `#${c.overlay}14`,
      "scrollbarSlider.hoverBackground": `#${c.overlay}24`,
      "scrollbarSlider.activeBackground": `#${c.overlay}33`,
      "minimap.background": c.background,
      focusBorder: "#00000000",
    },
  };
}

// Registers every theme with Monaco. Called once, before the editor mounts.
export function defineEditorThemes(monaco: Monaco) {
  for (const theme of EDITOR_THEMES) {
    monaco.editor.defineTheme(theme.id, buildTheme(theme));
  }
}