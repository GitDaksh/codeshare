"use client";

import { useEffect } from "react";
import type { CodeEditorHandle } from "@/components/CodeEditor";
import { formatRuns, heatStep, type HotspotsResult } from "@/lib/hotspots";
import "./hotspots.css";

export type HotspotsEditor = NonNullable<ReturnType<CodeEditorHandle["getEditor"]>>;
type Decorations = Parameters<HotspotsEditor["createDecorationsCollection"]>[0];

// Lines ignite in this many steps, top to bottom (see .hs-d* in hotspots.css).
const CASCADE = 24;

// Scrolls a line into view, puts the cursor on it and flashes it.
export function revealLine(editor: HotspotsEditor | null, line: number) {
  if (!editor) return;
  editor.revealLineInCenterIfOutsideViewport(line);
  editor.setPosition({ lineNumber: line, column: 1 });
  const flash = editor.createDecorationsCollection([
    {
      range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1 },
      options: { isWholeLine: true, className: "hs-flash" },
    },
  ]);
  setTimeout(() => flash.clear(), 1300);
  editor.focus();
}

// Paints the run into the editor: each line that ran glows in its heat color
// with a marker beside its number and its run count after its code; lines
// that could have run but never did fade back. Once the code changes the heat
// dims (it may no longer line up) until Hotspots runs again.
export function useEditorHeat(getEditor: () => HotspotsEditor | null, result: HotspotsResult | null, stale: boolean) {
  useEffect(() => {
    const editor = getEditor();
    const model = editor?.getModel();
    if (!editor || !model || !result) return;

    const lines = Math.min(model.getLineCount(), result.lineCount);
    const executable = new Set(result.executable);
    let hottestLine = 0;
    for (const [line, count] of result.counts) {
      if (count === result.hottest && (!hottestLine || line < hottestLine)) hottestLine = line;
    }

    const decorations: Decorations = [];
    for (let line = 1; line <= lines; line++) {
      const count = result.counts.get(line) ?? 0;
      const range = { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: model.getLineMaxColumn(line) };
      if (count > 0) {
        const delay = Math.round(((line - 1) / Math.max(lines - 1, 1)) * CASCADE);
        const tone = `hs-h${heatStep(count, result.hottest)} hs-d${delay}`;
        const hottest = line === hottestLine && result.hottest > 1 ? " hs-hottest" : "";
        decorations.push({
          range,
          options: {
            isWholeLine: true,
            className: `hs-line ${tone}${hottest}`,
            linesDecorationsClassName: `hs-bar ${tone}`,
            after: { content: `   ${formatRuns(count)}×`, inlineClassName: `hs-count ${tone}` },
          },
        });
      } else if (executable.has(line)) {
        decorations.push({ range, options: { inlineClassName: "hs-cold" } });
      }
    }

    const collection = editor.createDecorationsCollection(decorations);
    return () => collection.clear();
  }, [getEditor, result]);

  useEffect(() => {
    const node = getEditor()?.getContainerDomNode();
    if (!node) return;
    node.classList.toggle("hs-stale", stale && !!result);
    return () => node.classList.remove("hs-stale");
  }, [getEditor, stale, result]);
}