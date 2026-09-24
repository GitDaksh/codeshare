"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import { Check, Loader2 } from "lucide-react";
import { AvatarIcon } from "@/components/AvatarIcon";
import { EditorThemePicker } from "@/components/EditorThemePicker";
import { LANGUAGES } from "@/lib/languages";
import { getCursorShadeClass } from "@/lib/colors";
import { installSafariClipboardShim } from "@/lib/safariClipboardShim";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { defineEditorThemes } from "@/lib/editorTheme";

export type RemoteCursor = {
  userId: string;
  name: string;
  avatarId: string;
  line: number;
  column: number;
};

export type RemoteCodeUpdate = {
  code: string;
  nonce: number;
};

export type CodeEditorHandle = {
  getValue: () => string;
  setValue: (value: string) => void;
};

type MonacoEditorInstance = Parameters<OnMount>[0];

type CodeEditorProps = {
  language: string;
  initialValue: string;
  remoteUpdate: RemoteCodeUpdate | null;
  onChange: (value: string, line: number, column: number) => void;
  onCursorMove: (line: number, column: number) => void;
  onRunShortcut?: () => void;
  remoteCursors: RemoteCursor[];
  saveStatus: "saved" | "saving";
  minimapEnabled: boolean;
  fontSize: number;
  wordWrap: boolean;
  onToggleWordWrap?: () => void;
  themeId: string;
  onThemeChange?: (id: string) => void;
  handleRef?: MutableRefObject<CodeEditorHandle | null>;
};

const NAME_FLASH_MS = 1600;
const LINE_HEIGHT_RATIO = 1.6;

function lineHeightFor(fontSize: number): number {
  return Math.round(fontSize * LINE_HEIGHT_RATIO);
}

function handleEditorWillMount(monaco: Monaco) {
  installSafariClipboardShim();
  defineEditorThemes(monaco);
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

function offsetToPosition(text: string, offset: number): { lineNumber: number; column: number } {
  let line = 1;
  let col = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { lineNumber: line, column: col };
}

class RemoteCursorWidget {
  private domNode: HTMLElement;
  private badgeRoot: Root;
  private nameTimer: ReturnType<typeof setTimeout> | null = null;
  private avatarId: string;
  private position: { lineNumber: number; column: number };

  constructor(
    private readonly id: string,
    name: string,
    avatarId: string,
    position: { lineNumber: number; column: number },
    private readonly preference: number,
    lineColorClass: string,
    lineHeight: number
  ) {
    this.avatarId = avatarId;
    this.position = position;

    this.domNode = document.createElement("div");
    this.domNode.className = "remote-cursor-flag";
    this.setLineHeight(lineHeight);

    const line = document.createElement("div");
    line.className = `remote-cursor-line ${lineColorClass}`;

    const badge = document.createElement("div");
    badge.className = "remote-cursor-badge";

    const label = document.createElement("div");
    label.className = "remote-cursor-name";
    label.textContent = name;

    this.domNode.append(line, badge, label);

    this.badgeRoot = createRoot(badge, { identifierPrefix: `${id}-` });
    this.renderAvatar();
    this.flashName();
  }

  private renderAvatar() {
    this.badgeRoot.render(<AvatarIcon avatarId={this.avatarId} className="h-full w-full rounded-full" />);
  }

  private flashName() {
    this.domNode.classList.add("is-active");
    if (this.nameTimer) clearTimeout(this.nameTimer);
    this.nameTimer = setTimeout(() => this.domNode.classList.remove("is-active"), NAME_FLASH_MS);
  }

  getId() {
    return this.id;
  }

  getDomNode() {
    return this.domNode;
  }

  getPosition() {
    return {
      position: this.position,
      preference: [this.preference],
    };
  }

  updatePosition(position: { lineNumber: number; column: number }) {
    const moved =
      position.lineNumber !== this.position.lineNumber || position.column !== this.position.column;
    this.position = position;
    if (moved) this.flashName();
  }

  setAvatar(avatarId: string) {
    if (avatarId === this.avatarId) return;
    this.avatarId = avatarId;
    this.renderAvatar();
  }

  setLineHeight(lineHeight: number) {
    this.domNode.style.setProperty("--cursor-line-height", `${lineHeight}px`);
  }

  dispose() {
    if (this.nameTimer) clearTimeout(this.nameTimer);
    const root = this.badgeRoot;
    setTimeout(() => root.unmount(), 0);
  }
}

export function CodeEditor({
  language,
  initialValue,
  remoteUpdate,
  onChange,
  onCursorMove,
  onRunShortcut,
  remoteCursors,
  saveStatus,
  minimapEnabled,
  fontSize,
  wordWrap,
  onToggleWordWrap,
  themeId,
  onThemeChange,
  handleRef,
}: CodeEditorProps) {
  const [position, setPosition] = useState({ line: 1, column: 1 });
  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const widgetsRef = useRef<Map<string, RemoteCursorWidget>>(new Map());
  const lastEmitRef = useRef(0);
  const isApplyingRemoteRef = useRef(false);
  const onRunShortcutRef = useRef(onRunShortcut);
  const isNarrow = useMediaQuery("(max-width: 639px)");

  useEffect(() => {
    onRunShortcutRef.current = onRunShortcut;
  });

  useEffect(() => {
    if (!handleRef) return;

    handleRef.current = {
      getValue: () => editorRef.current?.getValue() ?? "",
      setValue: (value: string) => {
        const editor = editorRef.current;
        const model = editor?.getModel();
        if (!editor || !model) return;
        editor.executeEdits("format", [{ range: model.getFullModelRange(), text: value }]);
      },
    };

    return () => {
      handleRef.current = null;
    };
  }, [handleRef]);

  useEffect(() => {
    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message = typeof reason === "string" ? reason : reason?.message;
      if (message === "Canceled") {
        event.preventDefault();
      }
    }

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  }, []);

  useEffect(() => {
    const widgets = widgetsRef.current;
    return () => {
      widgets.forEach((widget) => {
        editorRef.current?.removeContentWidget(widget);
        widget.dispose();
      });
      widgets.clear();
    };
  }, []);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRunShortcutRef.current?.();
    });

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
    if (!editor || !monaco || !remoteUpdate) return;

    const model = editor.getModel();
    if (!model) return;

    const oldText = model.getValue();
    if (oldText === remoteUpdate.code) return;

    const { startOffset, endOffset, insertedText } = computeMinimalEdit(oldText, remoteUpdate.code);
    const deletedLength = endOffset - startOffset;
    const insertedLength = insertedText.length;

    const localPositionBefore = editor.getPosition();
    const localOffsetBefore = localPositionBefore ? model.getOffsetAt(localPositionBefore) : 0;

    let localOffsetAfter: number;
    if (localOffsetBefore <= startOffset) {
      localOffsetAfter = localOffsetBefore;
    } else if (localOffsetBefore >= endOffset) {
      localOffsetAfter = localOffsetBefore + (insertedLength - deletedLength);
    } else {
      localOffsetAfter = startOffset;
    }

    const newLocalPosition = offsetToPosition(remoteUpdate.code, localOffsetAfter);
    const startPos = model.getPositionAt(startOffset);
    const endPos = model.getPositionAt(endOffset);

    isApplyingRemoteRef.current = true;
    editor.executeEdits(
      "remote-sync",
      [
        {
          range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
          text: insertedText,
        },
      ],
      [
        new monaco.Selection(
          newLocalPosition.lineNumber,
          newLocalPosition.column,
          newLocalPosition.lineNumber,
          newLocalPosition.column
        ),
      ]
    );
    isApplyingRemoteRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteUpdate?.nonce]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const cursorLineHeight = lineHeightFor(fontSize) - 2;
    const activeIds = new Set(remoteCursors.map((c) => c.userId));

    for (const [userId, widget] of widgetsRef.current) {
      if (!activeIds.has(userId)) {
        editor.removeContentWidget(widget);
        widget.dispose();
        widgetsRef.current.delete(userId);
      }
    }

    for (const cursor of remoteCursors) {
      const pos = { lineNumber: cursor.line, column: cursor.column };

      let widget = widgetsRef.current.get(cursor.userId);
      if (!widget) {
        widget = new RemoteCursorWidget(
          `cursor-${cursor.userId}`,
          cursor.name,
          cursor.avatarId,
          pos,
          monaco.editor.ContentWidgetPositionPreference.EXACT,
          getCursorShadeClass(cursor.userId),
          cursorLineHeight
        );
        widgetsRef.current.set(cursor.userId, widget);
        editor.addContentWidget(widget);
      } else {
        widget.updatePosition(pos);
        widget.setAvatar(cursor.avatarId);
        widget.setLineHeight(cursorLineHeight);
        editor.layoutContentWidget(widget);
      }
    }
  }, [remoteCursors, fontSize]);

  const languageLabel = LANGUAGES.find((l) => l.value === language)?.label ?? language;

  return (
    <div className="flex h-full flex-col bg-ink-900">
      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          language={language}
          theme={themeId}
          defaultValue={initialValue}
          onChange={(val) => {
            if (isApplyingRemoteRef.current) return;
            const pos = editorRef.current?.getPosition();
            onChange(val ?? "", pos?.lineNumber ?? 1, pos?.column ?? 1);
          }}
          beforeMount={handleEditorWillMount}
          onMount={handleMount}
          options={{
            fontFamily: "var(--font-mono)",
            fontSize,
            lineHeight: lineHeightFor(fontSize),
            fontLigatures: true,
            minimap: { enabled: minimapEnabled },
            scrollBeyondLastLine: false,
            padding: { top: 20, bottom: 20 },
            automaticLayout: true,
            wordWrap: wordWrap ? "on" : "off",
            wrappingIndent: "same",
            lineNumbersMinChars: isNarrow ? 3 : 4,
            folding: !isNarrow,
            smoothScrolling: true,
            cursorSmoothCaretAnimation: "on",
            cursorBlinking: "smooth",
            cursorWidth: 2,
            renderLineHighlight: "line",
            roundedSelection: true,
            bracketPairColorization: { enabled: false },
            guides: { indentation: true, highlightActiveIndentation: true, bracketPairs: false },
            scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
            overviewRulerBorder: false,
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            glyphMargin: false,
            renderWhitespace: "none",
            stickyScroll: { enabled: false },
            fixedOverflowWidgets: true,
          }}
        />
      </div>
      <div className="flex h-7 shrink-0 items-center justify-between gap-3 border-t border-ink-800 bg-ink-950/60 px-3 text-[11px] text-ink-400">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink-400" />
          <span className="truncate font-medium text-ink-300">{languageLabel}</span>
        </span>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden items-center gap-1 lg:flex">
            <kbd className="font-[family-name:var(--font-mono)] text-ink-300">⌘↵</kbd> run
          </span>
          {onThemeChange && <EditorThemePicker value={themeId} onChange={onThemeChange} />}
          {onToggleWordWrap && (
            <button
              type="button"
              onClick={onToggleWordWrap}
              title={wordWrap ? "Disable word wrap" : "Enable word wrap"}
              className="hidden rounded px-1 transition-colors hover:bg-ink-800 hover:text-ink-100 sm:inline"
            >
              Wrap {wordWrap ? "on" : "off"}
            </button>
          )}
          <span className="tabular-nums">
            Ln {position.line}, Col {position.column}
          </span>
          <span className="flex items-center gap-1" title={saveStatus === "saving" ? "Saving…" : "All changes saved"}>
            {saveStatus === "saving" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3 text-ink-100" />
            )}
            <span className="hidden sm:inline">{saveStatus === "saving" ? "Saving" : "Saved"}</span>
          </span>
        </div>
      </div>
    </div>
  );
}