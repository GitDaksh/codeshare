"use client";

import {
  createContext,
  Fragment,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { motion } from "framer-motion";
import {
  fieldOf,
  indexMarks,
  indexUses,
  layoutObjects,
  nodeValueField,
  type LensDiff,
  type LensFrame,
  type LensGroup,
  type LensMarks,
  type LensObject,
  type LensSequence,
  type LensStep,
  type LensValue,
} from "@/lib/lens";

// How the memory view works: every pointer is a small dot carrying
// data-lens-ptr (the id of the object it points at), and every object box
// carries data-lens-obj. After each render, ArrowLayer measures both and
// draws an SVG curve from each dot to its object.

type Tone = "normal" | "active" | "changed";

// Theme colors (CSS variables, so arrows follow the palette): quiet for
// normal, stronger for active, strongest for what just changed.
const TONE_COLOR: Record<Tone, string> = {
  normal: "var(--ink-500)",
  active: "var(--ink-300)",
  changed: "var(--ink-100)",
};

const TREE_COLUMN = 60;
const TREE_ROW = 78;
const NODE_WIDTH = 48;

function cx(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(" ");
}

function primitiveClass(kind: string) {
  if (kind === "str") return "text-ink-300";
  if (kind === "none" || kind === "bool" || kind === "other") return "italic text-ink-400";
  return "tabular-nums text-ink-100";
}

// ---------- Values ----------

// Functions, classes and other small values (modules, generators...) are
// shown inline where they're referenced instead of as boxes with arrows:
// arrows to them would cross the whole diagram and add nothing.
const ObjectsContext = createContext<Map<string, LensObject>>(new Map());

// Where loop and pointer variables (i, j, lo, hi, mid…) point this step.
const MarksContext = createContext<LensMarks>({ cells: new Map(), rows: new Map(), columns: new Map() });

// A variable's name under the slot it points at, with a small caret.
function IndexMark({ names }: { names: string[] }) {
  return (
    <span
      data-lens-mark={names.join(" ")}
      className="pointer-events-none absolute left-1/2 top-full z-[1] mt-1 flex -translate-x-1/2 flex-col items-center"
    >
      <span className="h-0 w-0 border-x-4 border-b-4 border-x-transparent border-b-ink-100" />
      <span className="whitespace-nowrap rounded bg-ink-100 px-1 font-mono text-[9px] font-semibold leading-[14px] text-ink-950">
        {names.join(" ")}
      </span>
    </span>
  );
}

const isDefinition = (obj: LensObject | undefined) =>
  !!obj && (obj.k === "func" || obj.k === "class" || obj.k === "other");

function InlineDefinition({ obj }: { obj: LensObject }) {
  return (
    <span className="min-w-0 max-w-[12rem] truncate rounded border border-ink-800 bg-ink-900/60 px-1.5 py-px font-mono text-[11px] text-ink-400">
      {obj.k === "func" ? (
        <>
          <span className="italic text-ink-500">ƒ </span>
          {obj.name}
        </>
      ) : obj.k === "class" ? (
        <>
          <span className="text-ink-500">class </span>
          {obj.name}
        </>
      ) : obj.k === "other" ? (
        obj.text
      ) : null}
    </span>
  );
}

// A value that just changed glows briefly: a tint in the text color that
// fades out, so it shows on any background.
function Flash({ on, children, className }: { on: boolean; children: ReactNode; className?: string }) {
  if (!on) return <span className={className}>{children}</span>;
  return (
    <span className={cx("relative", className)}>
      {children}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-ink-100/15"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
      />
    </span>
  );
}

function Pointer({ target, source, tone, down }: { target: string; source: string; tone: Tone; down?: boolean }) {
  return (
    <span
      data-lens-ptr={target}
      data-lens-src={source}
      data-lens-tone={tone}
      data-lens-dir={down ? "down" : undefined}
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center"
    >
      <span
        className={cx(
          "h-2 w-2 rounded-full",
          tone === "changed"
            ? "bg-ink-100 shadow-[0_0_0_3px_color-mix(in_srgb,var(--ink-100)_14%,transparent)]"
            : tone === "active"
              ? "bg-ink-300"
              : "bg-ink-500",
        )}
      />
    </span>
  );
}

type ValueProps = {
  value: LensValue;
  source: string;
  tone: Tone;
  changed: boolean;
  stepIndex: number;
  down?: boolean;
};

function Value({ value, source, tone, changed, stepIndex, down }: ValueProps) {
  const objects = useContext(ObjectsContext);
  if (value[0] === "ref") {
    const target = objects.get(value[1]);
    if (target && isDefinition(target)) return <InlineDefinition obj={target} />;
    return <Pointer target={value[1]} source={source} tone={changed ? "changed" : tone} down={down} />;
  }
  return (
    <Flash
      key={changed ? `changed-${stepIndex}` : "same"}
      on={changed}
      className={cx("min-w-0 max-w-[12rem] truncate rounded px-1 font-mono text-xs", primitiveClass(value[0]))}
    >
      {value[1]}
    </Flash>
  );
}

// ---------- Frames ----------

function FrameCard({
  frame,
  index,
  active,
  diff,
  stepIndex,
}: {
  frame: LensFrame;
  index: number;
  active: boolean;
  diff: LensDiff;
  stepIndex: number;
}) {
  return (
    <div
      className={cx(
        "rounded-xl border transition-colors",
        active ? "border-ink-500 bg-ink-900" : "border-ink-800 bg-ink-900/40",
      )}
    >
      <div
        className={cx(
          "flex items-center justify-between gap-3 border-b px-3 py-1.5",
          active ? "border-ink-700" : "border-ink-800",
        )}
      >
        <span className={cx("truncate font-mono text-xs font-semibold", active ? "text-ink-100" : "text-ink-400")}>
          {frame.name}
        </span>
        {frame.line !== null && <span className="shrink-0 font-mono text-[10px] text-ink-500">line {frame.line}</span>}
      </div>
      {frame.vars.length === 0 ? (
        <p className="px-3 py-2 text-[11px] text-ink-600">No variables yet</p>
      ) : (
        <div className="py-1">
          {frame.vars.map(([name, value]) => {
            const isReturn = name === "return value";
            return (
              <div key={name} className="flex min-h-7 items-center justify-between gap-4 px-3 py-0.5">
                <span
                  className={cx(
                    "max-w-[9rem] shrink-0 truncate font-mono text-xs",
                    isReturn ? "italic text-ink-300" : "text-ink-400",
                  )}
                >
                  {isReturn ? "↩ return" : name}
                </span>
                <Value
                  value={value}
                  source={`frame${index}:${name}`}
                  tone={active ? "active" : "normal"}
                  changed={diff.changedVars.has(`${index}:${name}`)}
                  stepIndex={stepIndex}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- Objects ----------

function Label({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">{children}</span>
  );
}

// Objects fade and scale in when they first appear.
function Appear({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <motion.div
      data-lens-obj={id}
      className={className}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

type BoxProps = { diff: LensDiff; stepIndex: number };

function SequenceBox({
  obj,
  diff,
  stepIndex,
}: BoxProps & { obj: Extract<LensObject, { k: "list" | "tuple" | "set" }> }) {
  const indexed = obj.k !== "set";
  const marks = useContext(MarksContext).cells.get(obj.id);
  return (
    <div className={marks ? "pb-6" : undefined}>
      <Label>{obj.cls ?? obj.k}</Label>
      <Appear
        id={obj.id}
        className={cx("inline-flex border border-ink-700 bg-ink-900", obj.k === "set" ? "rounded-xl" : "rounded-lg")}
      >
        {obj.items.length === 0 && <span className="px-3 py-2 font-mono text-[11px] text-ink-600">empty</span>}
        {obj.items.map((item, position) => {
          const names = marks?.get(position);
          return (
            <div
              key={position}
              className={cx(
                "relative flex min-w-10 flex-col items-center justify-center gap-0.5 border-l border-ink-800 px-1.5 py-1.5 first:border-l-0",
                names && "bg-ink-800",
              )}
            >
              {indexed && <span className="font-mono text-[9px] leading-none text-ink-600">{position}</span>}
              <Value
                value={item}
                source={`${obj.id}:${position}`}
                tone="normal"
                changed={diff.changedSlots.has(`${obj.id}:${position}`)}
                stepIndex={stepIndex}
              />
              {names && <IndexMark names={names} />}
            </div>
          );
        })}
        {obj.more > 0 && (
          <span className="flex items-center border-l border-ink-800 px-2 font-mono text-[10px] text-ink-500">
            +{obj.more}
          </span>
        )}
      </Appear>
    </div>
  );
}

function DictBox({ obj, diff, stepIndex }: BoxProps & { obj: Extract<LensObject, { k: "dict" }> }) {
  return (
    <div>
      <Label>{obj.cls ?? "dict"}</Label>
      <Appear id={obj.id} className="inline-block min-w-[8.5rem] rounded-lg border border-ink-700 bg-ink-900 py-1">
        {obj.entries.length === 0 && (
          <span className="block px-3 py-1.5 font-mono text-[11px] text-ink-600">empty</span>
        )}
        {obj.entries.map(([key, value]) => (
          <div key={key[1]} className="flex min-h-7 items-center justify-between gap-5 px-2 py-0.5">
            <Value value={key} source={`${obj.id}:key:${key[1]}`} tone="normal" changed={false} stepIndex={stepIndex} />
            <Value
              value={value}
              source={`${obj.id}:${key[1]}`}
              tone="normal"
              changed={diff.changedSlots.has(`${obj.id}:${key[1]}`)}
              stepIndex={stepIndex}
            />
          </div>
        ))}
        {obj.more > 0 && <span className="block px-3 py-1 font-mono text-[10px] text-ink-500">+{obj.more} more</span>}
      </Appear>
    </div>
  );
}

function ObjectBox({
  obj,
  diff,
  stepIndex,
}: BoxProps & { obj: Extract<LensObject, { k: "obj" | "lnode" | "tnode" }> }) {
  return (
    <div>
      <Label>{obj.cls}</Label>
      <Appear id={obj.id} className="inline-block min-w-[8.5rem] rounded-lg border border-ink-700 bg-ink-900 py-1">
        {obj.fields.length === 0 && (
          <span className="block px-3 py-1.5 font-mono text-[11px] text-ink-600">no fields</span>
        )}
        {obj.fields.map(([name, value]) => (
          <div key={name} className="flex min-h-7 items-center justify-between gap-5 px-3 py-0.5">
            <span className="font-mono text-xs text-ink-400">{name}</span>
            <Value
              value={value}
              source={`${obj.id}:${name}`}
              tone="normal"
              changed={diff.changedSlots.has(`${obj.id}:${name}`)}
              stepIndex={stepIndex}
            />
          </div>
        ))}
      </Appear>
    </div>
  );
}

// A linked-list node: its value, then one slot per pointer (next, prev, ...).
function ListNodeBox({ obj, diff, stepIndex }: BoxProps & { obj: Extract<LensObject, { k: "lnode" }> }) {
  const valueName = nodeValueField(obj);
  const value = valueName ? fieldOf(obj, valueName) : undefined;
  const others = obj.fields.filter(([name]) => name !== valueName);
  return (
    <Appear
      id={obj.id}
      className="flex items-stretch rounded-lg border border-ink-600 bg-ink-900 shadow-raised"
    >
      <div className="flex min-w-12 flex-col items-center justify-center gap-0.5 px-2.5 py-1.5">
        <span className="font-mono text-[9px] uppercase tracking-wider text-ink-500">{valueName ?? obj.cls}</span>
        {value ? (
          <Value
            value={value}
            source={`${obj.id}:${valueName}`}
            tone="normal"
            changed={diff.changedSlots.has(`${obj.id}:${valueName}`)}
            stepIndex={stepIndex}
          />
        ) : (
          <span className="font-mono text-xs text-ink-600">·</span>
        )}
      </div>
      {others.map(([name, field]) => (
        <div
          key={name}
          className="flex flex-col items-center justify-center gap-0.5 border-l border-ink-700 px-2 py-1.5"
        >
          <span className="font-mono text-[9px] uppercase tracking-wider text-ink-500">{name}</span>
          {field[0] === "none" ? (
            <span className="font-mono text-[11px] leading-4 text-ink-600">∅</span>
          ) : (
            <Value
              value={field}
              source={`${obj.id}:${name}`}
              tone="normal"
              changed={diff.changedSlots.has(`${obj.id}:${name}`)}
              stepIndex={stepIndex}
            />
          )}
        </div>
      ))}
    </Appear>
  );
}

function ChildSlot({ value, source, changed }: { value: LensValue | undefined; source: string; changed: boolean }) {
  if (value && value[0] === "ref") {
    return <Pointer target={value[1]} source={source} tone={changed ? "changed" : "normal"} down />;
  }
  return <span className="h-4 w-4" />;
}

// A binary-tree node: its value, with left and right pointer slots underneath.
function TreeNodeBox({ obj, diff, stepIndex }: BoxProps & { obj: Extract<LensObject, { k: "tnode" }> }) {
  const valueName = nodeValueField(obj);
  const value = valueName ? fieldOf(obj, valueName) : undefined;
  return (
    <Appear
      id={obj.id}
      className="flex flex-col items-center rounded-xl border border-ink-600 bg-ink-900 pt-1.5 shadow-raised"
    >
      <div className="flex h-5 items-center">
        {value ? (
          <Value
            value={value}
            source={`${obj.id}:${valueName}`}
            tone="normal"
            changed={diff.changedSlots.has(`${obj.id}:${valueName}`)}
            stepIndex={stepIndex}
          />
        ) : (
          <span className="font-mono text-xs text-ink-600">·</span>
        )}
      </div>
      <div className="flex w-full justify-between px-1 pb-0.5">
        <ChildSlot
          value={fieldOf(obj, "left")}
          source={`${obj.id}:left`}
          changed={diff.changedSlots.has(`${obj.id}:left`)}
        />
        <ChildSlot
          value={fieldOf(obj, "right")}
          source={`${obj.id}:right`}
          changed={diff.changedSlots.has(`${obj.id}:right`)}
        />
      </div>
    </Appear>
  );
}

// A list of rows (a matrix, a DP table, a board) as one table: row and
// column numbers, row and column markers (i/r/row, j/c/col) and the cell where
// they cross highlighted. Each row keeps data-lens-obj, so a variable holding
// a row (row = grid[r]) still gets its arrow.
function GridBox({
  obj,
  rows,
  diff,
  stepIndex,
}: BoxProps & { obj: LensSequence; rows: string[] }) {
  const objects = useContext(ObjectsContext);
  const marks = useContext(MarksContext);
  const rowMarks = marks.rows.get(obj.id);
  const columnMarks = marks.columns.get(obj.id);
  const rowObjects = rows.flatMap((id) => {
    const row = objects.get(id);
    return row && (row.k === "list" || row.k === "tuple") ? [row] : [];
  });
  const width = Math.max(0, ...rowObjects.map((row) => row.items.length));
  const columns = Array.from({ length: width }, (_, column) => column);

  return (
    <div>
      <Label>
        {obj.cls ?? obj.k} · {rowObjects.length}×{width}
      </Label>
      <Appear id={obj.id} className="inline-block rounded-lg border border-ink-700 bg-ink-900 px-1.5 pb-1.5 pt-1">
        <table className="border-separate border-spacing-0">
          <thead>
            <tr>
              <th />
              {columns.map((column) => {
                const names = columnMarks?.get(column);
                return (
                  <th key={column} className="px-1 pb-1 align-bottom font-normal">
                    {names && (
                      <span
                        data-lens-mark={names.join(" ")}
                        data-lens-axis="column"
                        className="mb-0.5 block whitespace-nowrap rounded bg-ink-100 px-1 font-mono text-[9px] font-semibold leading-[14px] text-ink-950"
                      >
                        {names.join(" ")}
                      </span>
                    )}
                    <span className="block font-mono text-[9px] leading-none text-ink-600">{column}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rowObjects.map((row, r) => {
              const names = rowMarks?.get(r);
              return (
                <tr key={row.id} data-lens-obj={row.id}>
                  <th className="pr-1.5 text-right font-normal">
                    <span className="inline-flex items-center gap-1">
                      {names && (
                        <span
                          data-lens-mark={names.join(" ")}
                          data-lens-axis="row"
                          className="whitespace-nowrap rounded bg-ink-100 px-1 font-mono text-[9px] font-semibold leading-[14px] text-ink-950"
                        >
                          {names.join(" ")}
                        </span>
                      )}
                      <span className="font-mono text-[9px] text-ink-600">{r}</span>
                    </span>
                  </th>
                  {columns.map((column) => {
                    const item = row.items[column];
                    const crossed = !!names && !!columnMarks?.get(column);
                    const lit = !!names || !!columnMarks?.get(column);
                    return (
                      <td
                        key={column}
                        className={cx(
                          "h-7 min-w-9 border-l border-t border-ink-800 px-1 text-center first-of-type:border-l-0",
                          r === 0 && "border-t-0",
                          crossed ? "bg-ink-700" : lit && "bg-ink-800/60",
                        )}
                      >
                        {item ? (
                          <Value
                            value={item}
                            source={`${row.id}:${column}`}
                            tone="normal"
                            changed={diff.changedSlots.has(`${row.id}:${column}`)}
                            stepIndex={stepIndex}
                          />
                        ) : null}
                      </td>
                    );
                  })}
                  {row.more > 0 && <td className="px-1.5 font-mono text-[10px] text-ink-500">+{row.more}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Appear>
    </div>
  );
}

function ObjectView({ obj, diff, stepIndex }: BoxProps & { obj: LensObject }) {
  switch (obj.k) {
    case "list":
    case "tuple":
    case "set":
      return <SequenceBox obj={obj} diff={diff} stepIndex={stepIndex} />;
    case "dict":
      return <DictBox obj={obj} diff={diff} stepIndex={stepIndex} />;
    case "lnode":
      return <ListNodeBox obj={obj} diff={diff} stepIndex={stepIndex} />;
    case "tnode":
      return <TreeNodeBox obj={obj} diff={diff} stepIndex={stepIndex} />;
    case "obj":
      return <ObjectBox obj={obj} diff={diff} stepIndex={stepIndex} />;
    default:
      return <InlineDefinition obj={obj} />;
  }
}

function GroupView({
  group,
  objects,
  diff,
  stepIndex,
}: BoxProps & { group: LensGroup; objects: Map<string, LensObject> }) {
  if (group.kind === "single") {
    const obj = objects.get(group.id);
    return obj ? <ObjectView obj={obj} diff={diff} stepIndex={stepIndex} /> : null;
  }

  if (group.kind === "grid") {
    const obj = objects.get(group.id);
    return obj && (obj.k === "list" || obj.k === "tuple") ? (
      <GridBox obj={obj} rows={group.rows} diff={diff} stepIndex={stepIndex} />
    ) : null;
  }

  if (group.kind === "chain") {
    const first = objects.get(group.ids[0]);
    return (
      <div>
        <Label>{first && first.k === "lnode" ? first.cls : "linked list"}</Label>
        <div className="flex items-center gap-10">
          {group.ids.map((id) => {
            const obj = objects.get(id);
            return obj && obj.k === "lnode" ? (
              <ListNodeBox key={id} obj={obj} diff={diff} stepIndex={stepIndex} />
            ) : null;
          })}
        </div>
      </div>
    );
  }

  const root = objects.get(group.nodes.find((node) => node.y === 0)?.id ?? "");
  return (
    <div>
      <Label>{root && root.k === "tnode" ? root.cls : "tree"}</Label>
      <div
        className="relative"
        style={{
          width: group.columns * TREE_COLUMN,
          height: group.rows * TREE_ROW - 26,
        }}
      >
        {group.nodes.map((node) => {
          const obj = objects.get(node.id);
          if (!obj || obj.k !== "tnode") return null;
          return (
            <div
              key={node.id}
              className="absolute"
              style={{
                left: node.x * TREE_COLUMN + (TREE_COLUMN - NODE_WIDTH) / 2,
                top: node.y * TREE_ROW,
                width: NODE_WIDTH,
              }}
            >
              <TreeNodeBox obj={obj} diff={diff} stepIndex={stepIndex} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Arrows ----------

type Arrow = { key: string; d: string; tone: Tone };
type ArrowState = { arrows: Arrow[]; width: number; height: number };

function measureArrows(root: HTMLElement): ArrowState {
  const base = root.getBoundingClientRect();
  // If something above the view scales it (a transform, or zoom), screen
  // measurements are scaled too. Dividing by the ratio gets back to the
  // layout's own units, which the arrows are drawn in. At normal size the
  // ratio is 1 and nothing changes.
  const ratio = root.offsetWidth > 0 ? base.width / root.offsetWidth : 1;
  const k = Math.abs(ratio - 1) < 0.01 ? 1 : ratio;
  const arrows: Arrow[] = [];
  root.querySelectorAll<HTMLElement>("[data-lens-ptr]").forEach((dot) => {
    const target = root.querySelector<HTMLElement>(`[data-lens-obj="${dot.dataset.lensPtr}"]`);
    if (!target) return;
    const s = dot.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    const sx = (s.left + s.width / 2 - base.left) / k;
    const sy = (s.top + s.height / 2 - base.top) / k;
    const left = (t.left - base.left) / k;
    const top = (t.top - base.top) / k;
    const width = t.width / k;
    const height = t.height / k;
    let d: string;

    if (dot.dataset.lensDir === "down") {
      // Tree child: leave downwards, arrive on the child's top edge.
      const tx = left + width / 2;
      const bend = Math.max(16, (top - sy) / 2);
      d = `M ${sx} ${sy} C ${sx} ${sy + bend}, ${tx} ${top - bend}, ${tx} ${top}`;
    } else if (left >= sx + 6) {
      // Target to the right: arrive on its left edge.
      const ty = top + Math.min(height / 2, 18);
      const bend = Math.max(22, (left - sx) / 2);
      d = `M ${sx} ${sy} C ${sx + bend} ${sy}, ${left - bend} ${ty}, ${left} ${ty}`;
    } else if (top >= sy + 6) {
      // Target below: swing right, then drop onto its top edge.
      const tx = left + Math.min(width / 2, 22);
      d = `M ${sx} ${sy} C ${sx + 30} ${sy}, ${tx} ${top - 40}, ${tx} ${top}`;
    } else {
      // Target behind or above (a back pointer): loop around to its right edge.
      const tx = left + width;
      const ty = top + Math.min(height / 2, 18);
      const loop = Math.max(34, Math.abs(sy - ty) / 2);
      d = `M ${sx} ${sy} C ${sx + loop} ${sy}, ${tx + loop} ${ty}, ${tx} ${ty}`;
    }

    const tone = (dot.dataset.lensTone as Tone) ?? "normal";
    arrows.push({ key: dot.dataset.lensSrc ?? String(arrows.length), d, tone });
  });
  return { arrows, width: root.scrollWidth, height: root.scrollHeight };
}

// Re-measures after every step, keeps measuring while objects animate in,
// and whenever the view resizes. Kept separate so re-measuring never
// re-renders the frames and objects themselves.
function ArrowLayer({ contentRef, version }: { contentRef: RefObject<HTMLDivElement | null>; version: number }) {
  const [state, setState] = useState<ArrowState>({
    arrows: [],
    width: 0,
    height: 0,
  });
  const lastRef = useRef("");
  const markerId = `lens-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  useLayoutEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const update = () => {
      const next = measureArrows(root);
      const serialized = JSON.stringify(next);
      if (serialized === lastRef.current) return;
      lastRef.current = serialized;
      setState(next);
    };
    update();
    const started = performance.now();
    let frame = 0;
    const tick = () => {
      update();
      if (performance.now() - started < 650) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const observer = new ResizeObserver(update);
    observer.observe(root);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [contentRef, version]);

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 z-10 overflow-visible"
      width={state.width}
      height={state.height}
    >
      <defs>
        {(Object.keys(TONE_COLOR) as Tone[]).map((tone) => (
          <marker
            key={tone}
            id={`${markerId}-${tone}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: TONE_COLOR[tone] }} />
          </marker>
        ))}
      </defs>
      {state.arrows.map((arrow) => (
        <path
          key={arrow.key}
          d={arrow.d}
          fill="none"
          style={{ stroke: TONE_COLOR[arrow.tone] }}
          strokeWidth={arrow.tone === "changed" ? 2 : 1.5}
          strokeLinecap="round"
          markerEnd={`url(#${markerId}-${arrow.tone})`}
        />
      ))}
    </svg>
  );
}

// ---------- The memory view ----------

function Heading({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-500">{children}</p>;
}

// Stable keys, so a structure only animates in when it really changes.
function groupKey(group: LensGroup, position: number) {
  if (group.kind === "single") return group.id;
  if (group.kind === "chain") return `chain:${group.ids[0] ?? position}`;
  if (group.kind === "grid") return `grid:${group.id}`;
  return `tree:${group.nodes.find((node) => node.y === 0)?.id ?? position}`;
}

export function LensMemory({
  step,
  stepIndex,
  diff,
  code,
}: {
  step: LensStep;
  stepIndex: number;
  diff: LensDiff;
  // The program's code, so markers follow how it indexes each array.
  code?: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const objects = useMemo(() => new Map(step.heap.map((obj) => [obj.id, obj])), [step]);
  const groups = useMemo(() => layoutObjects(step.heap), [step]);
  const uses = useMemo(() => (code ? indexUses(code) : undefined), [code]);
  const marks = useMemo(() => indexMarks(step, groups, uses), [step, groups, uses]);
  const dataGroups = groups.filter((group) => !(group.kind === "single" && isDefinition(objects.get(group.id))));
  const active = step.frames.length - 1;

  return (
    <ObjectsContext.Provider value={objects}>
      <MarksContext.Provider value={marks}>
      <div className="h-full overflow-auto">
        <div ref={contentRef} className="relative min-h-full min-w-max p-5">
          <div className="grid grid-cols-[minmax(10rem,14rem)_auto] gap-x-14">
            <section aria-label="Frames">
              <Heading>Frames</Heading>
              <div className="flex flex-col gap-3">
                {step.frames.map((frame, index) => (
                  <Fragment key={`${index}:${frame.name}`}>
                    {index === 1 && step.hidden ? (
                      <p className="rounded-lg border border-dashed border-ink-800 px-3 py-1.5 text-center font-mono text-[10px] text-ink-500">
                        {step.hidden} more frames
                      </p>
                    ) : null}
                    <FrameCard
                      frame={frame}
                      index={index}
                      active={index === active}
                      diff={diff}
                      stepIndex={stepIndex}
                    />
                  </Fragment>
                ))}
              </div>
            </section>

            <section aria-label="Objects">
              <Heading>Objects</Heading>
              {dataGroups.length === 0 && <p className="text-xs text-ink-600">Nothing in memory yet</p>}
              <div className="flex flex-col items-start gap-7">
                {dataGroups.map((group, position) => (
                  <GroupView
                    key={groupKey(group, position)}
                    group={group}
                    objects={objects}
                    diff={diff}
                    stepIndex={stepIndex}
                  />
                ))}
              </div>
            </section>
          </div>
          <ArrowLayer contentRef={contentRef} version={stepIndex} />
        </div>
      </div>
      </MarksContext.Provider>
    </ObjectsContext.Provider>
  );
}