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

export type RemoteCodeUpdate = {
  code: string;
  nonce: number;
};

type MonacoEditorInstance = Parameters<OnMount>[0];
type MonacoModel = NonNullable<ReturnType<MonacoEditorInstance["getModel"]>>;

type CodeEditorProps = {
  language: string;
  initialValue: string;
  remoteUpdate: RemoteCodeUpdate | null;
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

function computeMinimalEdit(oldText: string, newText: string) {
  let prefixLen = 0;
  const maxPrefix = Math.min(oldText.length, newText.length);
  while (prefixLen < maxPrefix && oldText[prefixLen] === newText[prefixLen]) {
    prefixLen++;
  }

  let suffixLen = 0;
  const maxSuffix = Math.min(oldText.length - prefixLen, newText.length - prefixLen);
  while (
    suffixLen < maxSuffix &&
    oldText[oldText.length - 1 - suffixLen] === newText[newText.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  return {
    startOffset: prefixLen,
    endOffset: oldText.length - suffixLen,
    insertedText: newText.slice(prefixLen, newText.length - suffixLen),
  };
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
  initialValue,
  remoteUpdate,
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
  const isApplyingRemoteRef = useRef(false);

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

  // Apply remote edits surgically — only the changed range, never the whole buffer.
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !remoteUpdate) return;

    const model: MonacoModel | null = editor.getModel();
    if (!model) return;

    const oldText = model.getValue();
    if (oldText === remoteUpdate.code) return;

    const { startOffset, endOffset, insertedText } = computeMinimalEdit(oldText, remoteUpdate.code);
    const startPos = model.getPositionAt(startOffset);
    const endPos = model.getPositionAt(endOffset);

    isApplyingRemoteRef.current = true;
    editor.executeEdits("remote-sync", [
      {
        range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
        text: insertedText,
      },
    ]);
    isApplyingRemoteRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteUpdate?.nonce]);

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
          defaultValue={initialValue}
          onChange={(val) => {
            if (isApplyingRemoteRef.current) return;
            onChange(val ?? "");
          }}
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