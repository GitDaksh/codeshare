"use client";

import { useState } from "react";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import { LANGUAGES } from "@/lib/languages";

type CodeEditorProps = {
  language: string;
  value: string;
  onChange: (value: string) => void;
  saveStatus: "saved" | "saving";
};

function handleEditorWillMount(monaco: Monaco) {
  monaco.editor.defineTheme("codeshare-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#0D0D0D",
      "editor.lineHighlightBackground": "#1A1A1A",
    },
  });
}

export function CodeEditor({ language, value, onChange, saveStatus }: CodeEditorProps) {
  const [position, setPosition] = useState({ line: 1, column: 1 });

  const handleMount: OnMount = (editor) => {
    editor.onDidChangeCursorPosition((e) => {
      setPosition({ line: e.position.lineNumber, column: e.position.column });
    });
  };

  const languageLabel = LANGUAGES.find((l) => l.value === language)?.label ?? language;

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          language={language}
          theme="codeshare-dark"
          value={value}
          onChange={(val) => onChange(val ?? "")}
          beforeMount={handleEditorWillMount}
          onMount={handleMount}
          options={{
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 16 },
          }}
        />
      </div>
      <div className="flex items-center justify-between border-t border-ink-800 bg-ink-900 px-3 py-1 text-xs text-ink-500">
        <span>{languageLabel}</span>
        <div className="flex items-center gap-3">
          <span>
            Ln {position.line}, Col {position.column}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                saveStatus === "saving" ? "animate-pulse bg-ink-500" : "bg-ink-100"
              }`}
            />
            {saveStatus === "saving" ? "Saving…" : "Saved"}
          </span>
        </div>
      </div>
    </div>
  );
}