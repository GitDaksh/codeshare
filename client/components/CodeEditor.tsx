"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import * as Y from "yjs";
import { Check, Loader2 } from "lucide-react";
import { AvatarIcon } from "@/components/AvatarIcon";
import { EditorThemePicker } from "@/components/EditorThemePicker";
import { LANGUAGES } from "@/lib/languages";
import { getCursorShadeClass, getSelectionShadeClass } from "@/lib/colors";
import type { CollabSession } from "@/lib/collab";
import { installSafariClipboardShim } from "@/lib/safariClipboardShim";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { defineEditorThemes } from "@/lib/editorTheme";

export type EditorSelection = {
  text: string;
  startLine: number;
  endLine: number;
};

export type CodeEditorHandle = {
  getValue: () => string;
  setValue: (value: string) => void;
  getSelection: () => EditorSelection | null;
};

type MonacoEditorInstance = Parameters<OnMount>[0];

type CodeEditorProps = {
  language: string;
  initialValue: string;
  // Your own edits.
  onChange: (value: string, line: number, column: number) => void;
  // Teammates' edits (and undo or redo).
  onRemoteChange?: () => void;
  onRunShortcut?: () => void;
  onSendSelection?: () => void;
  // Shared editing (see lib/collab.ts): the room's document. The editor is
  // read-only until it first syncs; after that, edits, cursors and
  // selections are shared through it.
  collab?: CollabSession | null;
  collabReady?: boolean;
  collabGeneration?: number;
  // Follow mode: keep this teammate's cursor in view. Moving your own cursor
  // (typing, clicking, arrow keys) ends it.
  followUserId?: string | null;
  onStopFollowing?: () => void;
  saveStatus: "saved" | "saving";
  minimapEnabled: boolean;
  fontSize: number;
  wordWrap: boolean;
  onToggleWordWrap?: () => void;
  themeId: string;
  onThemeChange?: (id: string) => void;
  handleRef?: MutableRefObject<CodeEditorHandle | null>;
};

type SharedUser = { userId?: unknown; name?: unknown; avatarId?: unknown };
type SharedCursor = { anchor?: unknown; head?: unknown };

const NAME_FLASH_MS = 1600;
const LINE_HEIGHT_RATIO = 1.6;
// Your cursor is shared at most this often.
const CURSOR_SHARE_MS = 50;

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
  onChange,
  onRemoteChange,
  onRunShortcut,
  onSendSelection,
  collab = null,
  collabReady = false,
  collabGeneration = 0,
  followUserId = null,
  onStopFollowing,
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
  const [mounted, setMounted] = useState(false);
  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const widgetsRef = useRef<Map<number, RemoteCursorWidget>>(new Map());
  const isApplyingRemoteRef = useRef(false);
  const undoRef = useRef<Y.UndoManager | null>(null);
  const renderCursorsRef = useRef<(() => void) | null>(null);
  const followRef = useRef(followUserId);
  const fontSizeRef = useRef(fontSize);
  const onRunShortcutRef = useRef(onRunShortcut);
  const onSendSelectionRef = useRef(onSendSelection);
  const onRemoteChangeRef = useRef(onRemoteChange);
  const onStopFollowingRef = useRef(onStopFollowing);
  const isNarrow = useMediaQuery("(max-width: 639px)");

  useEffect(() => {
    onRunShortcutRef.current = onRunShortcut;
    onSendSelectionRef.current = onSendSelection;
    onRemoteChangeRef.current = onRemoteChange;
    onStopFollowingRef.current = onStopFollowing;
    fontSizeRef.current = fontSize;
  });

  // Starting to follow someone shows where they are right away.
  useEffect(() => {
    followRef.current = followUserId;
    renderCursorsRef.current?.();
  }, [followUserId]);

  // Teammates' cursors match the font size.
  useEffect(() => {
    renderCursorsRef.current?.();
  }, [fontSize]);

  useEffect(() => {
    if (!handleRef) return;

    handleRef.current = {
      getValue: () => editorRef.current?.getValue() ?? "",
      // Changes only the part that differs, so it merges well with
      // teammates' edits (and can be undone like typing).
      setValue: (value: string) => {
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        const model = editor?.getModel();
        if (!editor || !monaco || !model) return;
        const current = model.getValue();
        if (current === value) return;
        const { startOffset, endOffset, insertedText } = computeMinimalEdit(current, value);
        const start = model.getPositionAt(startOffset);
        const end = model.getPositionAt(endOffset);
        editor.executeEdits("codeshare", [
          { range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column), text: insertedText },
        ]);
      },
      getSelection: () => {
        const editor = editorRef.current;
        const model = editor?.getModel();
        const selection = editor?.getSelection();
        if (!editor || !model || !selection || selection.isEmpty()) return null;

        // A selection that ends at the very start of a line (e.g. after
        // selecting whole lines) doesn't really include that last line.
        const endLine =
          selection.endColumn === 1 && selection.endLineNumber > selection.startLineNumber
            ? selection.endLineNumber - 1
            : selection.endLineNumber;

        return {
          text: model.getValueInRange(selection),
          startLine: selection.startLineNumber,
          endLine,
        };
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

  // Shared editing: binds the editor to the room's document.
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!mounted || !editor || !monaco || !model || !collab || !collabReady) return;
    const { doc, text, undo, local, awareness } = collab;
    const widgets = widgetsRef.current;
    undoRef.current = undo;

    // Start from the shared text (always \n line endings, see the server).
    isApplyingRemoteRef.current = true;
    model.setEOL(monaco.editor.EndOfLineSequence.LF);
    if (model.getValue() !== text.toString()) model.setValue(text.toString());
    isApplyingRemoteRef.current = false;

    // Your edits → the shared document.
    const onModelChange = model.onDidChangeContent((event) => {
      if (isApplyingRemoteRef.current) return;
      doc.transact(() => {
        // Last change first, so earlier offsets stay valid.
        for (const change of [...event.changes].sort((a, b) => b.rangeOffset - a.rangeOffset)) {
          if (change.rangeLength) text.delete(change.rangeOffset, change.rangeLength);
          if (change.text) text.insert(change.rangeOffset, change.text);
        }
      }, local);
      scheduleRender();
    });

    // Your cursors, remembered as positions in the shared text before any
    // change, so they can be put back exactly after a teammate's edit.
    let saved: { anchor: Y.RelativePosition; head: Y.RelativePosition }[] = [];
    const rememberSelections = () => {
      saved = (editor.getSelections() ?? []).map((selection) => ({
        anchor: Y.createRelativePositionFromTypeIndex(
          text,
          model.getOffsetAt({ lineNumber: selection.selectionStartLineNumber, column: selection.selectionStartColumn }),
        ),
        head: Y.createRelativePositionFromTypeIndex(text, model.getOffsetAt(selection.getPosition())),
      }));
    };
    doc.on("beforeAllTransactions", rememberSelections);

    // Teammates' edits (and your undo or redo) → the editor.
    const onTextChange = (event: Y.YTextEvent, transaction: Y.Transaction) => {
      if (transaction.origin === local) return;
      isApplyingRemoteRef.current = true;
      try {
        let index = 0;
        for (const op of event.delta) {
          if (op.retain !== undefined) {
            index += op.retain;
          } else if (op.insert !== undefined) {
            const inserted = typeof op.insert === "string" ? op.insert : "";
            const at = model.getPositionAt(index);
            model.applyEdits([
              { range: new monaco.Range(at.lineNumber, at.column, at.lineNumber, at.column), text: inserted },
            ]);
            index += inserted.length;
          } else if (op.delete !== undefined) {
            const start = model.getPositionAt(index);
            const end = model.getPositionAt(index + op.delete);
            model.applyEdits([
              { range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column), text: "" },
            ]);
          }
        }
        const restored = saved.flatMap(({ anchor, head }) => {
          const a = Y.createAbsolutePositionFromRelativePosition(anchor, doc);
          const h = Y.createAbsolutePositionFromRelativePosition(head, doc);
          if (!a || !h) return [];
          const from = model.getPositionAt(a.index);
          const to = model.getPositionAt(h.index);
          return [new monaco.Selection(from.lineNumber, from.column, to.lineNumber, to.column)];
        });
        if (restored.length) editor.setSelections(restored);
      } finally {
        isApplyingRemoteRef.current = false;
      }
      onRemoteChangeRef.current?.();
      scheduleRender();
    };
    text.observe(onTextChange);

    // Your cursor and selection → everyone else (at most every 50 ms).
    let lastShared = 0;
    let shareTimer: ReturnType<typeof setTimeout> | null = null;
    const shareCursor = () => {
      const selection = editor.getSelection();
      if (!selection || !awareness) return;
      const anchor = model.getOffsetAt({
        lineNumber: selection.selectionStartLineNumber,
        column: selection.selectionStartColumn,
      });
      const head = model.getOffsetAt(selection.getPosition());
      awareness.setLocalStateField("cursor", {
        anchor: Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(text, anchor)),
        head: Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(text, head)),
      });
    };
    const onSelectionChange = editor.onDidChangeCursorSelection(() => {
      const wait = CURSOR_SHARE_MS - (Date.now() - lastShared);
      if (wait <= 0) {
        lastShared = Date.now();
        shareCursor();
      } else if (!shareTimer) {
        shareTimer = setTimeout(() => {
          shareTimer = null;
          lastShared = Date.now();
          shareCursor();
        }, wait);
      }
    });

    // Teammates' cursors and selections, drawn in their shade.
    const selections = editor.createDecorationsCollection();
    const absolute = (value: unknown) => {
      if (!value || typeof value !== "object") return null;
      try {
        const found = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(value), doc);
        return found && found.type === text ? model.getPositionAt(found.index) : null;
      } catch {
        return null;
      }
    };
    let frame = 0;
    const render = () => {
      frame = 0;
      if (!awareness) return;
      const lineHeight = lineHeightFor(fontSizeRef.current) - 2;
      const decorations: { range: InstanceType<Monaco["Range"]>; options: { className: string } }[] = [];
      const shown = new Set<number>();
      let followed: { lineNumber: number; column: number } | null = null;

      awareness.getStates().forEach((state, clientId) => {
        if (clientId === doc.clientID) return;
        const user = state.user as SharedUser | undefined;
        const cursor = state.cursor as SharedCursor | undefined;
        if (!user || typeof user.userId !== "string" || !cursor) return;
        const anchor = absolute(cursor.anchor);
        const head = absolute(cursor.head);
        if (!anchor || !head) return;
        shown.add(clientId);

        if (anchor.lineNumber !== head.lineNumber || anchor.column !== head.column) {
          const [from, to] =
            anchor.lineNumber < head.lineNumber || (anchor.lineNumber === head.lineNumber && anchor.column < head.column)
              ? [anchor, head]
              : [head, anchor];
          decorations.push({
            range: new monaco.Range(from.lineNumber, from.column, to.lineNumber, to.column),
            options: { className: getSelectionShadeClass(user.userId) },
          });
        }

        const name = typeof user.name === "string" ? user.name : "Someone";
        const avatarId = typeof user.avatarId === "string" ? user.avatarId : "";
        let widget = widgets.get(clientId);
        if (!widget) {
          widget = new RemoteCursorWidget(
            `cursor-${clientId}`,
            name,
            avatarId,
            head,
            monaco.editor.ContentWidgetPositionPreference.EXACT,
            getCursorShadeClass(user.userId),
            lineHeight,
          );
          widgets.set(clientId, widget);
          editor.addContentWidget(widget);
        } else {
          widget.updatePosition(head);
          widget.setAvatar(avatarId);
          widget.setLineHeight(lineHeight);
          editor.layoutContentWidget(widget);
        }
        if (user.userId === followRef.current) followed = head;
      });

      for (const [clientId, widget] of widgets) {
        if (shown.has(clientId)) continue;
        editor.removeContentWidget(widget);
        widget.dispose();
        widgets.delete(clientId);
      }
      selections.set(decorations);
      if (followed) editor.revealPositionInCenterIfOutsideViewport(followed, monaco.editor.ScrollType.Smooth);
    };
    const scheduleRender = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };
    renderCursorsRef.current = scheduleRender;
    awareness?.on("change", scheduleRender);

    shareCursor();
    render();

    return () => {
      onModelChange.dispose();
      onSelectionChange.dispose();
      doc.off("beforeAllTransactions", rememberSelections);
      text.unobserve(onTextChange);
      awareness?.off("change", scheduleRender);
      if (frame) cancelAnimationFrame(frame);
      if (shareTimer) clearTimeout(shareTimer);
      selections.clear();
      for (const widget of widgets.values()) {
        editor.removeContentWidget(widget);
        widget.dispose();
      }
      widgets.clear();
      renderCursorsRef.current = null;
      undoRef.current = null;
    };
  }, [mounted, collab, collabReady, collabGeneration]);

  const handleMount: OnMount = (editor, monaco) => {
    // Bracket colors are drawn by the text model, which ignores the editor's
    // bracketPairColorization option, so turn them off on the model itself.
    editor.getModel()?.updateOptions({
      bracketColorizationOptions: { enabled: false, independentColorPoolPerBracketType: false },
    });
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRunShortcutRef.current?.();
    });

    // Undo and redo. In a shared room they use the shared document's history
    // of your own edits, so a teammate's typing is never undone by your Ctrl+Z.
    const history = (action: "undo" | "redo") => {
      const undo = undoRef.current;
      if (!undo) editor.trigger("keyboard", action, null);
      else if (action === "undo") undo.undo();
      else undo.redo();
    };
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () => history("undo"));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ, () => history("redo"));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY, () => history("redo"));

    // Right-click menu entry, shown only when there's a selection.
    editor.addAction({
      id: "codeshare.send-selection-to-chat",
      label: "Send selection to chat",
      contextMenuGroupId: "navigation",
      contextMenuOrder: 0,
      precondition: "editorHasSelection",
      run: () => {
        onSendSelectionRef.current?.();
      },
    });

    editor.onDidChangeCursorPosition((e) => {
      setPosition({ line: e.position.lineNumber, column: e.position.column });
      // Moving your own cursor takes back control from follow mode.
      if (followRef.current && (e.source === "keyboard" || e.source === "mouse")) {
        onStopFollowingRef.current?.();
      }
    });

    setMounted(true);
  };

  const languageLabel = LANGUAGES.find((l) => l.value === language)?.label ?? language;
  const syncing = !!collab && !collabReady;

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
            readOnly: syncing,
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
          <span
            className="flex items-center gap-1"
            title={syncing ? "Syncing with the room…" : saveStatus === "saving" ? "Saving…" : "All changes saved"}
          >
            {syncing || saveStatus === "saving" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3 text-ink-100" />
            )}
            <span className="hidden sm:inline">{syncing ? "Syncing" : saveStatus === "saving" ? "Saving" : "Saved"}</span>
          </span>
        </div>
      </div>
    </div>
  );
}