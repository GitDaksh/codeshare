"use client";

import { useEffect, useRef, useState } from "react";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import { LANGUAGES } from "@/lib/languages";
import { getCursorShadeClass } from "@/lib/colors";

export type RemoteCursor = {
  userId: string;
  name: string;
  line: number;
  column: number;
};

type MonacoEditorInstance = Parameters<OnMount>[0];

type CodeEditorProps = {
  language: string;
  value: string;
  onChange: (value: string) => void;
  onCursorMove: (line: number, column: number) => void;
  remoteCursors: RemoteCursor[];
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

class RemoteCursorWidget {
  private domNode: HTMLElement;

  constructor(
    private readonly id: string,
    label: string,
    private position: { lineNumber: number; column: number },
    private readonly preference: number,
    colorClass: string
  ) {
    this.domNode = document.createElement("div");
    this.domNode.className = "remote-cursor-flag";

    const tag = document.createElement("div");
    tag.className = `remote-cursor-tag ${colorClass}`;
    tag.textContent = label;

    const line = document.createElement("div");
    line.className = `remote-cursor-line ${colorClass}`;

    this.domNode.appendChild(tag);
    this.domNode.appendChild(line);
  }

  getId() {
    return this.id;
  }

  getDomNode() {
    return this.domNode;
  }

  updatePosition(position: { lineNumber: number; column: number }) {
    this.position = position;
  }

  getPosition() {
    return {
      position: this.position,
      preference: [this.preference],
    };
  }
}

export function CodeEditor({
  language,
  value,
  onChange,
  onCursorMove,
  remoteCursors,
  saveStatus,
}: CodeEditorProps) {
  const [position, setPosition] = useState({ line: 1, column: 1 });
  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const widgetsRef = useRef<Map<string, RemoteCursorWidget>>(new Map());
  const lastEmitRef = useRef(0);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.onDidChangeCursorPosition((e) => {
      setPosition({ line: e.position.lineNumber, column: e.position.column });

      const now = Date.now();
      if (now - lastEmitRef.current > 80) {
        lastEmitRef.current = now;
        onCursorMove(e.position.lineNumber, e.position.column);
      }
    });
  };

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const activeIds = new Set(remoteCursors.map((c) => c.userId));

    for (const [userId, widget] of widgetsRef.current) {
      if (!activeIds.has(userId)) {
        editor.removeContentWidget(widget);
        widgetsRef.current.delete(userId);
      }
    }

    for (const cursor of remoteCursors) {
      const colorClass = getCursorShadeClass(cursor.userId);
      const pos = { lineNumber: cursor.line, column: cursor.column };

      let widget = widgetsRef.current.get(cursor.userId);
      if (!widget) {
        widget = new RemoteCursorWidget(
          `cursor-${cursor.userId}`,
          cursor.name,
          pos,
          monaco.editor.ContentWidgetPositionPreference.ABOVE,
          colorClass
        );
        widgetsRef.current.set(cursor.userId, widget);
        editor.addContentWidget(widget);
      } else {
        widget.updatePosition(pos);
        editor.layoutContentWidget(widget);
      }
    }
  }, [remoteCursors]);

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
            lineHeight: 21,
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