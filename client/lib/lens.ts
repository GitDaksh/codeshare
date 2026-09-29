// Lens: watch a program run, step by step.
//
// LENS_TRACER_PY is Python source. It runs inside the existing Python sandbox
// (see tracePython in execution.ts): it pauses before every line of the
// user's program, records the call stack, every variable and every object
// they reach, and finally prints the whole recording as one JSON line after
// a marker. Everything below it is the TypeScript side: types, parsing, and
// the pure helpers the visualizer uses to lay out memory and spot changes.

// Kept in sync with _LENS_MAX_STEPS in the tracer.
export const LENS_MAX_STEPS = 1000;
const LENS_MARKER = "__CODESHARE_LENS__";

// Plain text: no backticks or "${" (String.raw keeps it exactly as written).
const LENS_TRACER_PY = String.raw`import sys as _lens_sys
import json as _lens_json
import types as _lens_types

_LENS_FILE = "<lens>"
_LENS_SETUP_FILE = "<lens-setup>"
_LENS_MARKER = "__CODESHARE_LENS__"
_LENS_MAX_STEPS = 1000
_LENS_MAX_ITEMS = 60
_LENS_MAX_OBJECTS = 250
_LENS_MAX_FRAMES = 30
_LENS_MAX_TEXT = 100
_LENS_MAX_OUTPUT = 20000


class _LensStop(BaseException):
    """Raised by the tracer to end a run that hit the step limit."""


class _LensOutput:
    """Collects everything the program prints, so each step knows how much had been printed."""

    def __init__(self):
        self.parts = []
        self.size = 0
        self.clipped = False

    def write(self, text):
        text = str(text)
        room = _LENS_MAX_OUTPUT - self.size
        if room <= 0:
            self.clipped = True
            return len(text)
        if len(text) > room:
            text = text[:room]
            self.clipped = True
        self.parts.append(text)
        self.size += len(text)
        return len(text)

    def flush(self):
        pass

    def value(self):
        return "".join(self.parts)


def _lens_text(value):
    try:
        text = repr(value)
    except BaseException:
        text = "<?>"
    if len(text) > _LENS_MAX_TEXT:
        text = text[: _LENS_MAX_TEXT - 1] + "…"
    return text


def _lens_primitive(value):
    if value is None:
        return ["none", "None"]
    kind = type(value)
    if kind is bool:
        return ["bool", "True" if value else "False"]
    if kind is int:
        try:
            text = str(value)
        except ValueError:
            text = "<huge int>"
        if len(text) > 30:
            text = text[:14] + "…" + text[-14:]
        return ["int", text]
    if kind is float:
        return ["float", repr(value)]
    if kind is str:
        return ["str", _lens_text(value)]
    if kind is complex or kind is bytes or kind is range:
        return ["other", _lens_text(value)]
    return None


def _lens_attrs(value):
    try:
        attrs = object.__getattribute__(value, "__dict__")
    except BaseException:
        return None
    return attrs if isinstance(attrs, dict) else None


def _lens_describe(oid, value, ref):
    kind = type(value)
    name = getattr(kind, "__name__", "object")
    if kind is list or kind is tuple:
        items = [ref(item) for item in value[:_LENS_MAX_ITEMS]]
        return {"id": oid, "k": "list" if kind is list else "tuple", "items": items, "more": max(0, len(value) - _LENS_MAX_ITEMS)}
    if isinstance(value, dict):
        entries = []
        for position, pair in enumerate(value.items()):
            if position >= _LENS_MAX_ITEMS:
                break
            entries.append([ref(pair[0]), ref(pair[1])])
        described = {"id": oid, "k": "dict", "entries": entries, "more": max(0, len(value) - _LENS_MAX_ITEMS)}
        if kind is not dict:
            described["cls"] = name
        return described
    if isinstance(value, (set, frozenset)):
        members = list(value)
        try:
            members.sort()
        except BaseException:
            pass
        described = {"id": oid, "k": "set", "items": [ref(item) for item in members[:_LENS_MAX_ITEMS]], "more": max(0, len(members) - _LENS_MAX_ITEMS)}
        if kind is not set:
            described["cls"] = name
        return described
    if name == "deque" and getattr(kind, "__module__", "") == "collections":
        members = []
        for position, item in enumerate(value):
            if position >= _LENS_MAX_ITEMS:
                break
            members.append(item)
        return {"id": oid, "k": "list", "cls": "deque", "items": [ref(item) for item in members], "more": max(0, len(value) - _LENS_MAX_ITEMS)}
    if isinstance(value, _lens_types.MethodType):
        value = value.__func__
    if isinstance(value, _lens_types.FunctionType):
        code = value.__code__
        params = list(code.co_varnames[: code.co_argcount + code.co_kwonlyargcount])
        title = "lambda" if value.__name__ == "<lambda>" else value.__qualname__
        return {"id": oid, "k": "func", "name": title, "params": ", ".join(params)}
    if isinstance(value, type):
        return {"id": oid, "k": "class", "name": value.__name__}
    if isinstance(value, _lens_types.ModuleType):
        return {"id": oid, "k": "other", "text": "module " + value.__name__}
    attrs = _lens_attrs(value)
    if attrs is not None:
        fields = []
        for position, pair in enumerate(attrs.items()):
            if position >= _LENS_MAX_ITEMS:
                break
            key = str(pair[0])
            if key.startswith("__"):
                continue
            fields.append([key, ref(pair[1])])
        keys = set(attrs.keys())
        if "next" in keys and len(keys) >= 2:
            shape = "lnode"
        elif "left" in keys and "right" in keys:
            shape = "tnode"
        else:
            shape = "obj"
        return {"id": oid, "k": shape, "cls": name, "fields": fields}
    return {"id": oid, "k": "other", "text": _lens_text(value)}


def _lens_snapshot(specs):
    """specs: [(name, line, [(var, value), ...]), ...] from the outermost frame inwards."""
    heap = []
    index = {}
    queue = []

    def ref(value):
        primitive = _lens_primitive(value)
        if primitive is not None:
            return primitive
        oid = "o" + str(id(value))
        if oid not in index:
            if len(index) >= _LENS_MAX_OBJECTS:
                return ["other", "…"]
            index[oid] = len(heap)
            heap.append(None)
            queue.append((oid, value))
        return ["ref", oid]

    frames = []
    for name, line, items in specs:
        frames.append({"name": name, "line": line, "vars": [[var, ref(value)] for var, value in items]})
    position = 0
    while position < len(queue):
        oid, value = queue[position]
        position += 1
        try:
            heap[index[oid]] = _lens_describe(oid, value, ref)
        except BaseException:
            heap[index[oid]] = {"id": oid, "k": "other", "text": _lens_text(value)}
    return frames, heap


# Names defined by the setup code (helpers like lens_list); never shown.
_lens_setup_names = set()


def _lens_hidden(name, value):
    if name in _lens_setup_names:
        return True
    if isinstance(name, str) and name.startswith("__") and name.endswith("__"):
        return True
    return isinstance(value, _lens_types.ModuleType)


def _lens_is_class_body(code):
    # Module and class bodies are the only code without "optimized" locals;
    # of those, class bodies aren't named <module>.
    return code.co_name != "<module>" and not (code.co_flags & 0x0001)


def _lens_frame_spec(frame, extra):
    code = frame.f_code
    if code.co_name == "<module>":
        items = [(k, v) for k, v in frame.f_globals.items() if not _lens_hidden(k, v)]
        return ("Global", frame.f_lineno, items + extra)
    title = getattr(code, "co_qualname", code.co_name)
    items = [(k, v) for k, v in list(frame.f_locals.items()) if not _lens_hidden(k, v)]
    return (title, frame.f_lineno, items + extra)


def _lens_exception_text(exc):
    text = str(exc)
    return type(exc).__name__ + (": " + text if text else "")


def _lens_error_line(exc):
    line = None
    tb = exc.__traceback__
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == _LENS_FILE:
            line = tb.tb_lineno
        tb = tb.tb_next
    return line


def _lens_called_by_setup(frame):
    current = frame.f_back
    while current is not None:
        if current.f_code.co_filename == _LENS_SETUP_FILE:
            return True
        current = current.f_back
    return False


def _lens_main(code, setup=""):
    global _lens_setup_names
    result = {"steps": [], "stdout": "", "error": None, "truncated": False, "outputClipped": False}
    steps = result["steps"]
    try:
        compiled = compile(code, _LENS_FILE, "exec")
    except SyntaxError as exc:
        result["error"] = {"line": exc.lineno, "message": "SyntaxError: " + str(exc.msg)}
        print(_LENS_MARKER + _lens_json.dumps(result, separators=(",", ":")))
        return

    output = _LensOutput()
    namespace = {"__name__": "__main__"}
    _lens_setup_names = set()
    if setup:
        # Helpers (like building a test's linked list) run first and unrecorded.
        try:
            exec(compile(setup, _LENS_SETUP_FILE, "exec"), namespace)
        except BaseException as exc:
            result["error"] = {"line": None, "message": "Lens setup failed: " + _lens_exception_text(exc)}
            print(_LENS_MARKER + _lens_json.dumps(result, separators=(",", ":")))
            return
        _lens_setup_names = set(namespace.keys())

    def record(frame, event, arg):
        if len(steps) >= _LENS_MAX_STEPS:
            result["truncated"] = True
            raise _LensStop()
        chain = []
        current = frame
        while current is not None:
            code = current.f_code
            if code.co_filename == _LENS_FILE and not _lens_is_class_body(code):
                chain.append(current)
            current = current.f_back
        chain.reverse()
        if not chain:
            return
        hidden = 0
        if len(chain) > _LENS_MAX_FRAMES:
            hidden = len(chain) - _LENS_MAX_FRAMES
            chain = chain[:1] + chain[hidden + 1:]
        specs = []
        for position, item in enumerate(chain):
            extra = []
            if event == "return" and position == len(chain) - 1:
                extra = [("return value", arg)]
            specs.append(_lens_frame_spec(item, extra))
        frames, heap = _lens_snapshot(specs)
        step = {"line": frame.f_lineno, "event": event, "frames": frames, "heap": heap, "out": output.size}
        if hidden:
            step["hidden"] = hidden
        if event == "exception":
            step["exc"] = _lens_exception_text(arg[1])
        steps.append(step)

    def tracer(frame, event, arg):
        code = frame.f_code
        if code.co_filename != _LENS_FILE or _lens_is_class_body(code):
            return None
        # The user's code called from a setup helper (e.g. their ListNode
        # constructor while a helper builds the input) isn't recorded either.
        if event == "call" and setup and _lens_called_by_setup(frame):
            return None
        if event == "line":
            record(frame, "line", arg)
        elif event == "return" and code.co_name != "<module>":
            record(frame, "return", arg)
        elif event == "exception" and not isinstance(arg[1], _LensStop):
            record(frame, "exception", arg)
        return tracer

    saved_out, saved_err = _lens_sys.stdout, _lens_sys.stderr
    _lens_sys.stdout = output
    _lens_sys.stderr = output
    _lens_sys.settrace(tracer)
    try:
        exec(compiled, namespace)
    except _LensStop:
        result["truncated"] = True
    except SystemExit:
        pass
    except BaseException as exc:
        result["error"] = {"line": _lens_error_line(exc), "message": _lens_exception_text(exc)}
    finally:
        _lens_sys.settrace(None)
        _lens_sys.stdout, _lens_sys.stderr = saved_out, saved_err

    if result["error"] is None and not result["truncated"]:
        items = [(k, v) for k, v in namespace.items() if not _lens_hidden(k, v)]
        frames, heap = _lens_snapshot([("Global", None, items)])
        steps.append({"line": None, "event": "end", "frames": frames, "heap": heap, "out": output.size})
    result["stdout"] = output.value()
    result["outputClipped"] = output.clipped
    print(_LENS_MARKER + _lens_json.dumps(result, separators=(",", ":")))
`;

// The program the sandbox actually runs: the tracer, then a call that traces
// the user's code. JSON string literals are valid Python string literals.
// "setup" is optional helper code that runs first and is never recorded
// (see lensPractice.ts).
export function buildTraceProgram(code: string, setup = ""): string {
  return LENS_TRACER_PY + "\n_lens_main(" + JSON.stringify(code) + ", " + JSON.stringify(setup) + ")\n";
}

// ---------- The recording ----------

export type LensPrimitiveKind = "none" | "bool" | "int" | "float" | "str" | "other";

// A value is either shown directly ([kind, text]) or points at an object.
export type LensValue = [LensPrimitiveKind, string] | ["ref", string];

export type LensObject =
  | {
      id: string;
      k: "list" | "tuple" | "set";
      cls?: string;
      items: LensValue[];
      more: number;
    }
  | {
      id: string;
      k: "dict";
      cls?: string;
      entries: [LensValue, LensValue][];
      more: number;
    }
  | { id: string; k: "obj"; cls: string; fields: [string, LensValue][] }
  // Objects with a "next" field (linked-list nodes) and with "left" and
  // "right" fields (binary-tree nodes) are drawn as diagrams.
  | { id: string; k: "lnode"; cls: string; fields: [string, LensValue][] }
  | { id: string; k: "tnode"; cls: string; fields: [string, LensValue][] }
  | { id: string; k: "func"; name: string; params: string }
  | { id: string; k: "class"; name: string }
  | { id: string; k: "other"; text: string };

// Lists, tuples and sets.
export type LensSequence = Extract<LensObject, { k: "list" | "tuple" | "set" }>;

export type LensFrame = {
  name: string;
  line: number | null;
  vars: [string, LensValue][];
};

export type LensStep = {
  // The line about to run (null once the program has finished).
  line: number | null;
  event: "line" | "return" | "exception" | "end";
  frames: LensFrame[];
  heap: LensObject[];
  // How many characters of output had been printed by this step.
  out: number;
  exc?: string;
  // Frames left out of the middle of a very deep call stack.
  hidden?: number;
};

export type LensTrace = {
  steps: LensStep[];
  stdout: string;
  error: { line: number | null; message: string } | null;
  truncated: boolean;
  outputClipped: boolean;
};

export function parseTraceOutput(output: string): LensTrace | null {
  const start = output.lastIndexOf(LENS_MARKER);
  if (start === -1) return null;
  const end = output.indexOf("\n", start);
  const json = output.slice(start + LENS_MARKER.length, end === -1 ? undefined : end);
  try {
    return sanitizeTrace(JSON.parse(json));
  } catch {
    return null;
  }
}

// ---------- Validation ----------

// Recordings can come from other people's browsers (shared Lens sessions), so
// everything is checked before it's drawn: a malformed recording is rejected
// instead of crashing the view.
const PRIMITIVE_KINDS = new Set(["none", "bool", "int", "float", "str", "other"]);
const STEP_EVENTS = new Set(["line", "return", "exception", "end"]);
const OBJECT_ID = /^[A-Za-z0-9_-]{1,64}$/;

const isText = (value: unknown): value is string => typeof value === "string";
const isCount = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= 0;
const isLine = (value: unknown) => value === null || isCount(value);

function isValue(value: unknown): value is LensValue {
  if (!Array.isArray(value) || value.length !== 2 || !isText(value[0]) || !isText(value[1])) return false;
  return value[0] === "ref" ? OBJECT_ID.test(value[1]) : PRIMITIVE_KINDS.has(value[0]);
}

function isPairList(value: unknown, isFirst: (item: unknown) => boolean): boolean {
  return (
    Array.isArray(value) &&
    value.every((pair) => Array.isArray(pair) && pair.length === 2 && isFirst(pair[0]) && isValue(pair[1]))
  );
}

function isLensObject(value: unknown): value is LensObject {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if (!isText(obj.id) || !OBJECT_ID.test(obj.id)) return false;
  const cls = obj.cls === undefined || isText(obj.cls);
  switch (obj.k) {
    case "list":
    case "tuple":
    case "set":
      return cls && Array.isArray(obj.items) && obj.items.every(isValue) && isCount(obj.more);
    case "dict":
      return cls && isPairList(obj.entries, isValue) && isCount(obj.more);
    case "obj":
    case "lnode":
    case "tnode":
      return isText(obj.cls) && isPairList(obj.fields, isText);
    case "func":
      return isText(obj.name) && isText(obj.params);
    case "class":
      return isText(obj.name);
    case "other":
      return isText(obj.text);
    default:
      return false;
  }
}

function isFrame(value: unknown): value is LensFrame {
  if (!value || typeof value !== "object") return false;
  const frame = value as Record<string, unknown>;
  return isText(frame.name) && isLine(frame.line) && isPairList(frame.vars, isText);
}

function isStep(value: unknown): value is LensStep {
  if (!value || typeof value !== "object") return false;
  const step = value as Record<string, unknown>;
  return (
    isLine(step.line) &&
    isText(step.event) &&
    STEP_EVENTS.has(step.event) &&
    Array.isArray(step.frames) &&
    step.frames.length <= 64 &&
    step.frames.every(isFrame) &&
    Array.isArray(step.heap) &&
    step.heap.length <= 400 &&
    step.heap.every(isLensObject) &&
    isCount(step.out) &&
    (step.exc === undefined || isText(step.exc)) &&
    (step.hidden === undefined || isCount(step.hidden))
  );
}

export function sanitizeTrace(data: unknown): LensTrace | null {
  if (!data || typeof data !== "object") return null;
  const trace = data as Record<string, unknown>;
  if (!Array.isArray(trace.steps) || trace.steps.length > LENS_MAX_STEPS + 1 || !trace.steps.every(isStep)) return null;
  if (!isText(trace.stdout)) return null;
  const error = trace.error as { line?: unknown; message?: unknown } | null | undefined;
  if (error != null && (typeof error !== "object" || !isText(error.message) || !isLine(error.line ?? null))) {
    return null;
  }
  return {
    steps: trace.steps as LensStep[],
    stdout: trace.stdout,
    error: error ? { line: (error.line as number | null) ?? null, message: error.message as string } : null,
    truncated: trace.truncated === true,
    outputClipped: trace.outputClipped === true,
  };
}

// ---------- Helpers for the visualizer ----------

const VALUE_FIELDS = ["val", "value", "data", "key"];

export function fieldOf(obj: LensObject, name: string): LensValue | undefined {
  if (obj.k !== "obj" && obj.k !== "lnode" && obj.k !== "tnode") return undefined;
  return obj.fields.find(([field]) => field === name)?.[1];
}

// The field that holds a node's value, if it has one of the usual names.
export function nodeValueField(obj: LensObject): string | null {
  if (obj.k !== "lnode" && obj.k !== "tnode") return null;
  return VALUE_FIELDS.find((name) => obj.fields.some(([field]) => field === name)) ?? null;
}

function refTarget(value: LensValue | undefined): string | null {
  return value && value[0] === "ref" ? value[1] : null;
}

export type LensTreeNode = { id: string; x: number; y: number };

export type LensGroup =
  | { kind: "chain"; ids: string[] }
  | { kind: "tree"; nodes: LensTreeNode[]; columns: number; rows: number }
  // A list of rows (a matrix, a DP table, a board), drawn as one table.
  | { kind: "grid"; id: string; rows: string[] }
  | { kind: "single"; id: string };

// Arranges the objects of one step into drawable groups: linked-list nodes
// become chains (following next pointers), tree nodes become laid-out trees
// (in-order x, depth y), and everything else is drawn on its own. Groups keep
// the order in which the program's variables first reach them.
export function layoutObjects(heap: LensObject[]): LensGroup[] {
  const byId = new Map(heap.map((obj) => [obj.id, obj]));
  const order = new Map(heap.map((obj, position) => [obj.id, position]));
  const placed = new Set<string>();
  const groups: { at: number; group: LensGroup }[] = [];
  const firstIndex = (ids: string[]) => Math.min(...ids.map((id) => order.get(id) ?? Infinity));

  // Linked lists: start from nodes that no other node points to.
  const listNodes = heap.filter((obj) => obj.k === "lnode");
  const pointedAt = new Set<string>();
  for (const node of listNodes) {
    const next = refTarget(fieldOf(node, "next"));
    if (next && byId.get(next)?.k === "lnode") pointedAt.add(next);
  }
  const chainFrom = (start: string) => {
    const ids: string[] = [];
    let current: string | null = start;
    while (current && !placed.has(current) && byId.get(current)?.k === "lnode") {
      placed.add(current);
      ids.push(current);
      current = refTarget(fieldOf(byId.get(current)!, "next"));
    }
    return ids;
  };
  for (const pass of [false, true]) {
    for (const node of listNodes) {
      if (placed.has(node.id) || (!pass && pointedAt.has(node.id))) continue;
      const ids = chainFrom(node.id);
      groups.push({ at: firstIndex(ids), group: { kind: "chain", ids } });
    }
  }

  // Trees: start from nodes that aren't anyone's left or right child.
  const treeNodes = heap.filter((obj) => obj.k === "tnode");
  const children = new Set<string>();
  for (const node of treeNodes) {
    for (const side of ["left", "right"]) {
      const child = refTarget(fieldOf(node, side));
      if (child && byId.get(child)?.k === "tnode") children.add(child);
    }
  }
  const layoutTree = (root: string) => {
    const nodes: LensTreeNode[] = [];
    let column = 0;
    let deepest = 0;
    const visit = (id: string | null, depth: number) => {
      if (!id || placed.has(id)) return;
      const obj = byId.get(id);
      if (!obj || obj.k !== "tnode") return;
      placed.add(id);
      visit(refTarget(fieldOf(obj, "left")), depth + 1);
      nodes.push({ id, x: column++, y: depth });
      deepest = Math.max(deepest, depth);
      visit(refTarget(fieldOf(obj, "right")), depth + 1);
    };
    visit(root, 0);
    return { nodes, columns: column, rows: deepest + 1 };
  };
  for (const pass of [false, true]) {
    for (const node of treeNodes) {
      if (placed.has(node.id) || (!pass && children.has(node.id))) continue;
      const tree = layoutTree(node.id);
      groups.push({
        at: firstIndex(tree.nodes.map((n) => n.id)),
        group: { kind: "tree", ...tree },
      });
    }
  }

  // Grids: a list whose items are all separate lists of plain values, each
  // used nowhere else, is drawn as one table. A list holding the same row
  // more than once (like [[0] * 3] * 3) keeps its arrows, which show that.
  const references = new Map<string, number>();
  for (const obj of heap) {
    for (const [, value] of objectSlots(obj)) {
      const target = refTarget(value);
      if (target) references.set(target, (references.get(target) ?? 0) + 1);
    }
    if (obj.k === "dict") {
      for (const [key] of obj.entries) {
        const target = refTarget(key);
        if (target) references.set(target, (references.get(target) ?? 0) + 1);
      }
    }
  }
  const isPlainRow = (id: string | null) => {
    const row = id ? byId.get(id) : undefined;
    return (
      !!row &&
      (row.k === "list" || row.k === "tuple") &&
      row.cls !== "deque" &&
      !placed.has(row.id) &&
      references.get(row.id) === 1 &&
      row.items.every((item) => item[0] !== "ref")
    );
  };
  for (const obj of heap) {
    if (placed.has(obj.id) || (obj.k !== "list" && obj.k !== "tuple") || obj.cls === "deque") continue;
    if (obj.items.length < 2 || obj.more > 0) continue;
    const rows = obj.items.map(refTarget);
    if (new Set(rows).size !== rows.length || !rows.every(isPlainRow)) continue;
    placed.add(obj.id);
    for (const id of rows) placed.add(id!);
    groups.push({ at: order.get(obj.id)!, group: { kind: "grid", id: obj.id, rows: rows as string[] } });
  }

  for (const obj of heap) {
    if (!placed.has(obj.id))
      groups.push({
        at: order.get(obj.id)!,
        group: { kind: "single", id: obj.id },
      });
  }
  return groups.sort((a, b) => a.at - b.at).map((entry) => entry.group);
}

// ---------- Index markers ----------

// Loop and pointer variables are marked under the array slot they point at.
// Only whole numbers in range count, and only from the function that's
// running. Names like x or k are usually values or sizes, not positions, so
// they're left out rather than risk a misleading marker.
const INDEX_NAME =
  /^(i|j|l|r|lo|hi|low|high|mid|left|right|start|end|slow|fast|idx|index|pos|ptr|read|write|parent|child|smallest|largest)$|(_idx|Idx|_index|Index)$/;
// In a grid, row indices mark rows and column indices mark columns.
const ROW_NAME = /^(i|r|row)$/;
const COLUMN_NAME = /^(j|c|col|column)$/;

// How the code uses variables as array indexes: nums[i], left[i],
// self.items[child] (first) and dp[i][j] (second, for grid columns). Only
// exact uses count: nums[j + 1] would put a marker one slot off.
export type LensIndexUses = { first: Map<string, Set<string>>; second: Map<string, Set<string>> };

const NAME = "[A-Za-z_$][\\w$]*";
const FIRST_INDEX = new RegExp(`\\b(${NAME})\\s*\\[\\s*(${NAME})\\s*\\]`, "g");
const SECOND_INDEX = new RegExp(`\\b(${NAME})\\s*\\[[^\\][]*\\]\\s*\\[\\s*(${NAME})\\s*\\]`, "g");

export function indexUses(code: string): LensIndexUses {
  const collect = (pattern: RegExp) => {
    const uses = new Map<string, Set<string>>();
    for (const [, array, index] of code.matchAll(pattern)) {
      uses.set(array, (uses.get(array) ?? new Set()).add(index));
    }
    return uses;
  };
  return { first: collect(FIRST_INDEX), second: collect(SECOND_INDEX) };
}

export type LensMarks = {
  // Array id → position → the variables pointing there.
  cells: Map<string, Map<number, string[]>>;
  // Grid id → row (or column) → the variables pointing there.
  rows: Map<string, Map<number, string[]>>;
  columns: Map<string, Map<number, string[]>>;
};

// With the code, a variable marks the arrays the code indexes with it
// (left[i] marks left, not right); variables the code never uses as an index
// (like lo and hi in a binary search) fall back to the name rule.
export function indexMarks(step: LensStep, groups: LensGroup[], uses?: LensIndexUses): LensMarks {
  const marks: LensMarks = { cells: new Map(), rows: new Map(), columns: new Map() };
  const frame = step.frames[step.frames.length - 1];
  if (!frame) return marks;
  const numbers = frame.vars.flatMap(([name, value]) => {
    const n = value[0] === "int" ? Number(value[1]) : NaN;
    return Number.isInteger(n) && n >= 0 ? [[name, n] as const] : [];
  });
  if (numbers.length === 0) return marks;

  const byId = new Map(step.heap.map((obj) => [obj.id, obj]));
  const isArray = (obj: LensObject | undefined): obj is LensSequence =>
    !!obj && (obj.k === "list" || obj.k === "tuple");
  // The arrays a function holds, with the names it holds them by: its own
  // variables, or one step through an object it holds (self.items).
  const held = (vars: [string, LensValue][]) => {
    const names = new Map<string, Set<string>>();
    const hold = (id: string, name: string) => names.set(id, (names.get(id) ?? new Set()).add(name));
    for (const [name, value] of vars) {
      const target = byId.get(refTarget(value) ?? "");
      if (isArray(target)) hold(target.id, name);
      else if (target?.k === "obj") {
        for (const [field, fieldValue] of target.fields) {
          const inner = byId.get(refTarget(fieldValue) ?? "");
          if (isArray(inner)) hold(inner.id, field);
        }
      }
    }
    return names;
  };
  // A function that holds no arrays works on those of the functions around
  // it: a nested helper on its parent's board, or a recursive call on a
  // global grid.
  let arrays = held(frame.vars);
  for (let index = step.frames.length - 2; arrays.size === 0 && index >= 0; index--) {
    arrays = held(step.frames[index].vars);
  }

  const grids = new Map<string, Extract<LensGroup, { kind: "grid" }>>();
  const gridRows = new Set<string>();
  for (const group of groups) {
    if (group.kind !== "grid") continue;
    grids.set(group.id, group);
    for (const id of group.rows) gridRows.add(id);
  }
  const add = (map: Map<string, Map<number, string[]>>, id: string, position: number, name: string) => {
    const positions = map.get(id) ?? new Map<number, string[]>();
    positions.set(position, [...(positions.get(position) ?? []), name]);
    map.set(id, positions);
  };
  // Every variable the code uses as some array's index.
  const indexes = new Set<string>();
  for (const table of [uses?.first, uses?.second]) {
    for (const names of table?.values() ?? []) for (const name of names) indexes.add(name);
  }
  // Does the code index this array (by any of its names) with this variable?
  const indexedBy = (table: Map<string, Set<string>> | undefined, arrayNames: Set<string>, name: string) =>
    [...arrayNames].some((arrayName) => table?.get(arrayName)?.has(name) ?? false);

  for (const [id, arrayNames] of arrays) {
    const obj = byId.get(id);
    if (!isArray(obj) || gridRows.has(id)) continue;
    const grid = grids.get(id);
    if (grid) {
      const width = Math.max(0, ...grid.rows.map((rowId) => {
        const row = byId.get(rowId);
        return isArray(row) ? row.items.length : 0;
      }));
      for (const [name, n] of numbers) {
        const byName = !indexes.has(name);
        if (n < grid.rows.length && (indexedBy(uses?.first, arrayNames, name) || (byName && ROW_NAME.test(name)))) {
          add(marks.rows, id, n, name);
        }
        if (n < width && (indexedBy(uses?.second, arrayNames, name) || (byName && COLUMN_NAME.test(name)))) {
          add(marks.columns, id, n, name);
        }
      }
    } else {
      for (const [name, n] of numbers) {
        if (n >= obj.items.length) continue;
        if (indexedBy(uses?.first, arrayNames, name) || (!indexes.has(name) && INDEX_NAME.test(name))) {
          add(marks.cells, id, n, name);
        }
      }
    }
  }
  return marks;
}

export type LensDiff = {
  // "frameIndex:name" for variables that are new or changed since the last step.
  changedVars: Set<string>;
  // "objectId:slot" for list items, dict entries and fields that changed.
  changedSlots: Set<string>;
  // Objects that didn't exist in the last step.
  newObjects: Set<string>;
};

function sameValue(a: LensValue | undefined, b: LensValue | undefined): boolean {
  return !!a && !!b && a[0] === b[0] && a[1] === b[1];
}

export function objectSlots(obj: LensObject): [string, LensValue][] {
  switch (obj.k) {
    case "list":
    case "tuple":
    case "set":
      return obj.items.map((item, position) => [String(position), item]);
    case "dict":
      return obj.entries.map(([key, value]) => [key[1], value]);
    case "obj":
    case "lnode":
    case "tnode":
      return obj.fields;
    default:
      return [];
  }
}

export function diffSteps(previous: LensStep | undefined, current: LensStep): LensDiff {
  const diff: LensDiff = {
    changedVars: new Set(),
    changedSlots: new Set(),
    newObjects: new Set(),
  };
  if (!previous) return diff;

  current.frames.forEach((frame, position) => {
    const before = previous.frames[position];
    // A frame that was just called is new as a whole; don't flash every variable.
    if (!before || before.name !== frame.name) return;
    const old = new Map(before.vars);
    for (const [name, value] of frame.vars) {
      if (!sameValue(old.get(name), value)) diff.changedVars.add(`${position}:${name}`);
    }
  });

  const oldObjects = new Map(previous.heap.map((obj) => [obj.id, obj]));
  for (const obj of current.heap) {
    const before = oldObjects.get(obj.id);
    if (!before) {
      diff.newObjects.add(obj.id);
      continue;
    }
    const old = new Map(objectSlots(before));
    for (const [slot, value] of objectSlots(obj)) {
      if (!sameValue(old.get(slot), value)) diff.changedSlots.add(`${obj.id}:${slot}`);
    }
  }
  return diff;
}

// A short sentence describing what a step is about to do.
export function describeStep(trace: LensTrace, index: number): { text: string; tone: "normal" | "error" | "done" } {
  const step = trace.steps[index];
  const last = index === trace.steps.length - 1;
  // The last step of a crashed run gives the full error, with its line.
  if (last && trace.error) {
    const where = trace.error.line ? ` (line ${trace.error.line})` : "";
    return { text: trace.error.message + where, tone: "error" };
  }
  if (step.event === "exception") return { text: step.exc ?? "An exception was raised", tone: "error" };
  if (last && trace.truncated) {
    return {
      text: `Stopped after ${LENS_MAX_STEPS.toLocaleString()} steps. An infinite loop, maybe?`,
      tone: "error",
    };
  }
  if (step.event === "end") return { text: "Program finished", tone: "done" };
  if (step.event === "return") {
    const frame = step.frames[step.frames.length - 1];
    const value = frame?.vars.find(([name]) => name === "return value")?.[1];
    const shown = !value ? "" : value[0] === "ref" ? " an object" : ` ${value[1]}`;
    return {
      text: `${frame?.name ?? "Function"} returns${shown}`,
      tone: "normal",
    };
  }
  return {
    text: step.line ? `Line ${step.line} runs next` : "Running",
    tone: "normal",
  };
}