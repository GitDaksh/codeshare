"use client";

import Editor, { type Monaco } from "@monaco-editor/react";

type CodeEditorProps = {
  language: string;
  value: string;
  onChange: (value: string) => void;
};

function handleEditorWillMount(monaco: Monaco) {
  monaco.editor.defineTheme("codeshare-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#171717",
      "editor.lineHighlightBackground": "#1f1f1f",
    },
  });
}

export function CodeEditor({ language, value, onChange }: CodeEditorProps) {
  return (
    <Editor
      height="100%"
      language={language}
      theme="codeshare-dark"
      value={value}
      onChange={(val) => onChange(val ?? "")}
      beforeMount={handleEditorWillMount}
      options={{
        fontFamily: "var(--font-mono)",
        fontSize: 14,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        padding: { top: 16 },
      }}
    />
  );
}