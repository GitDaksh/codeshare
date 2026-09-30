import type { LensFrame, LensObject, LensStep, LensTrace } from "@/lib/lens";

// Real Lens recordings for the landing page, made with the app's own
// JavaScript tracer (the same one rooms use). They're packed: every distinct
// frame and object is stored once, and each step lists which ones it shows,
// as [line, event, frame indexes, object indexes]. unpack() rebuilds the
// trace the Lens renderer expects.

type PackedStep = [line: number | null, event: number, frames: number[], objects: number[]];

export type LensDemo = {
  id: string;
  title: string;
  code: string;
  frames: LensFrame[];
  objects: LensObject[];
  steps: PackedStep[];
};

const EVENTS: LensStep["event"][] = ["line", "return", "exception", "end"];

export function unpack(demo: LensDemo): LensTrace {
  return {
    steps: demo.steps.map(([line, event, frames, objects]) => ({
      line,
      event: EVENTS[event],
      frames: frames.map((index) => demo.frames[index]),
      heap: objects.map((index) => demo.objects[index]),
      out: 0,
    })),
    stdout: "",
    error: null,
    truncated: false,
    outputClipped: false,
  };
}

export const LENS_DEMOS: LensDemo[] = [
  {
    id: "binary-search",
    title: "Binary search",
    code: `function binarySearch(nums, target) {
  let lo = 0;
  let hi = nums.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (nums[mid] === target) {
      return mid;
    }
    if (nums[mid] < target) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return -1;
}

console.log(binarySearch([2, 5, 8, 12, 16, 23, 38, 56, 72, 91], 23));
`,
    frames: [
      {"name": "Global", "line": 18, "vars": [["binarySearch", ["ref", "o1"]]]},
      {"name": "binarySearch", "line": 2, "vars": [["nums", ["ref", "o2"]], ["target", ["int", "23"]]]},
      {"name": "binarySearch", "line": 3, "vars": [["nums", ["ref", "o2"]], ["target", ["int", "23"]], ["lo", ["int", "0"]]]},
      {"name": "binarySearch", "line": 4, "vars": [["nums", ["ref", "o2"]], ["target", ["int", "23"]], ["lo", ["int", "0"]], ["hi", ["int", "9"]]]},
      {"name": "binarySearch", "line": 5, "vars": [["nums", ["ref", "o2"]], ["target", ["int", "23"]], ["lo", ["int", "0"]], ["hi", ["int", "9"]]]},
      {"name": "binarySearch", "line": 6, "vars": [["nums", ["ref", "o2"]], ["target", ["int", "23"]], ["lo", ["int", "0"]], ["hi", ["int", "9"]], ["mid", ["int", "4"]]]},
      {"name": "binarySearch", "line": 9, "vars": [["nums", ["ref", "o2"]], ["target", ["int", "23"]], ["lo", ["int", "0"]], ["hi", ["int", "9"]], ["mid", ["int", "4"]]]},
      {"name": "binarySearch", "line": 10, "vars": [["nums", ["ref", "o2"]], ["target", ["int", "23"]], ["lo", ["int", "0"]], ["hi", ["int", "9"]], ["mid", ["int", "4"]]]},
      {"name": "binarySearch", "line": 4, "vars": [["nums", ["ref", "o2"]], ["target", ["int", "23"]], ["lo", ["int", "5"]], ["hi", ["int", "9"]]]},
      {"name": "binarySearch", "line": 5, "vars": [["nums", ["ref", "o2"]], ["target", ["int", "23"]], ["lo", ["int", "5"]], ["hi", ["int", "9"]]]},
      {"name": "binarySearch", "line": 6, "vars": [["nums", ["ref", "o2"]], ["target", ["int", "23"]], ["lo", ["int", "5"]], ["hi", ["int", "9"]], ["mid", ["int", "7"]]]},
      {"name": "binarySearch", "line": 9, "vars": [["nums", ["ref", "o2"]], ["target", ["int", "23"]], ["lo", ["int", "5"]], ["hi", ["int", "9"]], ["mid", ["int", "7"]]]},
      {"name": "binarySearch", "line": 12, "vars": [["nums", ["ref", "o2"]], ["target", ["int", "23"]], ["lo", ["int", "5"]], ["hi", ["int", "9"]], ["mid", ["int", "7"]]]},
      {"name": "binarySearch", "line": 4, "vars": [["nums", ["ref", "o2"]], ["target", ["int", "23"]], ["lo", ["int", "5"]], ["hi", ["int", "6"]]]},
      {"name": "binarySearch", "line": 5, "vars": [["nums", ["ref", "o2"]], ["target", ["int", "23"]], ["lo", ["int", "5"]], ["hi", ["int", "6"]]]},
      {"name": "binarySearch", "line": 6, "vars": [["nums", ["ref", "o2"]], ["target", ["int", "23"]], ["lo", ["int", "5"]], ["hi", ["int", "6"]], ["mid", ["int", "5"]]]},
      {"name": "binarySearch", "line": 7, "vars": [["nums", ["ref", "o2"]], ["target", ["int", "23"]], ["lo", ["int", "5"]], ["hi", ["int", "6"]], ["mid", ["int", "5"]]]},
      {"name": "binarySearch", "line": 7, "vars": [["nums", ["ref", "o2"]], ["target", ["int", "23"]], ["lo", ["int", "5"]], ["hi", ["int", "6"]], ["mid", ["int", "5"]], ["return value", ["int", "5"]]]},
    ],
    objects: [
      {"id": "o1", "k": "func", "name": "binarySearch", "params": "nums, target"},
      {"id": "o2", "k": "list", "items": [["int", "2"], ["int", "5"], ["int", "8"], ["int", "12"], ["int", "16"], ["int", "23"], ["int", "38"], ["int", "56"], ["int", "72"], ["int", "91"]], "more": 0},
    ],
    steps: [
      [18, 0, [0], [0]],
      [2, 0, [0, 1], [0, 1]],
      [3, 0, [0, 2], [0, 1]],
      [4, 0, [0, 3], [0, 1]],
      [5, 0, [0, 4], [0, 1]],
      [6, 0, [0, 5], [0, 1]],
      [9, 0, [0, 6], [0, 1]],
      [10, 0, [0, 7], [0, 1]],
      [4, 0, [0, 8], [0, 1]],
      [5, 0, [0, 9], [0, 1]],
      [6, 0, [0, 10], [0, 1]],
      [9, 0, [0, 11], [0, 1]],
      [12, 0, [0, 12], [0, 1]],
      [4, 0, [0, 13], [0, 1]],
      [5, 0, [0, 14], [0, 1]],
      [6, 0, [0, 15], [0, 1]],
      [7, 0, [0, 16], [0, 1]],
      [7, 1, [0, 17], [0, 1]],
      [null, 3, [0], [0]],
    ],
  },
  {
    id: "linked-list",
    title: "Reverse a linked list",
    code: `class ListNode {
  constructor(val, next = null) {
    this.val = val;
    this.next = next;
  }
}

function reverse(head) {
  let prev = null;
  while (head) {
    const next = head.next;
    head.next = prev;
    prev = head;
    head = next;
  }
  return prev;
}

let head = null;
for (const value of [4, 3, 2, 1]) {
  head = new ListNode(value, head);
}
head = reverse(head);
`,
    frames: [
      {"name": "Global", "line": 1, "vars": [["reverse", ["ref", "o1"]]]},
      {"name": "Global", "line": 19, "vars": [["ListNode", ["ref", "o2"]], ["reverse", ["ref", "o1"]]]},
      {"name": "Global", "line": 20, "vars": [["ListNode", ["ref", "o2"]], ["reverse", ["ref", "o1"]], ["head", ["none", "null"]], ["value", ["int", "4"]]]},
      {"name": "Global", "line": 21, "vars": [["ListNode", ["ref", "o2"]], ["reverse", ["ref", "o1"]], ["head", ["none", "null"]], ["value", ["int", "4"]]]},
      {"name": "ListNode.constructor", "line": 3, "vars": [["val", ["int", "4"]], ["next", ["none", "null"]], ["this", ["ref", "o3"]]]},
      {"name": "ListNode.constructor", "line": 4, "vars": [["val", ["int", "4"]], ["next", ["none", "null"]], ["this", ["ref", "o3"]]]},
      {"name": "ListNode.constructor", "line": 4, "vars": [["val", ["int", "4"]], ["next", ["none", "null"]], ["this", ["ref", "o3"]], ["return value", ["none", "undefined"]]]},
      {"name": "Global", "line": 20, "vars": [["ListNode", ["ref", "o2"]], ["reverse", ["ref", "o1"]], ["head", ["ref", "o3"]], ["value", ["int", "3"]]]},
      {"name": "Global", "line": 21, "vars": [["ListNode", ["ref", "o2"]], ["reverse", ["ref", "o1"]], ["head", ["ref", "o3"]], ["value", ["int", "3"]]]},
      {"name": "ListNode.constructor", "line": 3, "vars": [["val", ["int", "3"]], ["next", ["ref", "o3"]], ["this", ["ref", "o4"]]]},
      {"name": "ListNode.constructor", "line": 4, "vars": [["val", ["int", "3"]], ["next", ["ref", "o3"]], ["this", ["ref", "o4"]]]},
      {"name": "ListNode.constructor", "line": 4, "vars": [["val", ["int", "3"]], ["next", ["ref", "o3"]], ["this", ["ref", "o4"]], ["return value", ["none", "undefined"]]]},
      {"name": "Global", "line": 20, "vars": [["ListNode", ["ref", "o2"]], ["reverse", ["ref", "o1"]], ["head", ["ref", "o4"]], ["value", ["int", "2"]]]},
      {"name": "Global", "line": 21, "vars": [["ListNode", ["ref", "o2"]], ["reverse", ["ref", "o1"]], ["head", ["ref", "o4"]], ["value", ["int", "2"]]]},
      {"name": "ListNode.constructor", "line": 3, "vars": [["val", ["int", "2"]], ["next", ["ref", "o4"]], ["this", ["ref", "o5"]]]},
      {"name": "ListNode.constructor", "line": 4, "vars": [["val", ["int", "2"]], ["next", ["ref", "o4"]], ["this", ["ref", "o5"]]]},
      {"name": "ListNode.constructor", "line": 4, "vars": [["val", ["int", "2"]], ["next", ["ref", "o4"]], ["this", ["ref", "o5"]], ["return value", ["none", "undefined"]]]},
      {"name": "Global", "line": 20, "vars": [["ListNode", ["ref", "o2"]], ["reverse", ["ref", "o1"]], ["head", ["ref", "o5"]], ["value", ["int", "1"]]]},
      {"name": "Global", "line": 21, "vars": [["ListNode", ["ref", "o2"]], ["reverse", ["ref", "o1"]], ["head", ["ref", "o5"]], ["value", ["int", "1"]]]},
      {"name": "ListNode.constructor", "line": 3, "vars": [["val", ["int", "1"]], ["next", ["ref", "o5"]], ["this", ["ref", "o6"]]]},
      {"name": "ListNode.constructor", "line": 4, "vars": [["val", ["int", "1"]], ["next", ["ref", "o5"]], ["this", ["ref", "o6"]]]},
      {"name": "ListNode.constructor", "line": 4, "vars": [["val", ["int", "1"]], ["next", ["ref", "o5"]], ["this", ["ref", "o6"]], ["return value", ["none", "undefined"]]]},
      {"name": "Global", "line": 23, "vars": [["ListNode", ["ref", "o2"]], ["reverse", ["ref", "o1"]], ["head", ["ref", "o6"]]]},
      {"name": "reverse", "line": 9, "vars": [["head", ["ref", "o6"]]]},
      {"name": "reverse", "line": 10, "vars": [["head", ["ref", "o6"]], ["prev", ["none", "null"]]]},
      {"name": "reverse", "line": 11, "vars": [["head", ["ref", "o6"]], ["prev", ["none", "null"]]]},
      {"name": "reverse", "line": 12, "vars": [["head", ["ref", "o6"]], ["prev", ["none", "null"]], ["next", ["ref", "o5"]]]},
      {"name": "reverse", "line": 13, "vars": [["head", ["ref", "o6"]], ["prev", ["none", "null"]], ["next", ["ref", "o5"]]]},
      {"name": "reverse", "line": 14, "vars": [["head", ["ref", "o6"]], ["prev", ["ref", "o6"]], ["next", ["ref", "o5"]]]},
      {"name": "reverse", "line": 10, "vars": [["head", ["ref", "o5"]], ["prev", ["ref", "o6"]]]},
      {"name": "reverse", "line": 11, "vars": [["head", ["ref", "o5"]], ["prev", ["ref", "o6"]]]},
      {"name": "reverse", "line": 12, "vars": [["head", ["ref", "o5"]], ["prev", ["ref", "o6"]], ["next", ["ref", "o4"]]]},
      {"name": "reverse", "line": 13, "vars": [["head", ["ref", "o5"]], ["prev", ["ref", "o6"]], ["next", ["ref", "o4"]]]},
      {"name": "reverse", "line": 14, "vars": [["head", ["ref", "o5"]], ["prev", ["ref", "o5"]], ["next", ["ref", "o4"]]]},
      {"name": "reverse", "line": 10, "vars": [["head", ["ref", "o4"]], ["prev", ["ref", "o5"]]]},
      {"name": "reverse", "line": 11, "vars": [["head", ["ref", "o4"]], ["prev", ["ref", "o5"]]]},
      {"name": "reverse", "line": 12, "vars": [["head", ["ref", "o4"]], ["prev", ["ref", "o5"]], ["next", ["ref", "o3"]]]},
      {"name": "reverse", "line": 13, "vars": [["head", ["ref", "o4"]], ["prev", ["ref", "o5"]], ["next", ["ref", "o3"]]]},
      {"name": "reverse", "line": 14, "vars": [["head", ["ref", "o4"]], ["prev", ["ref", "o4"]], ["next", ["ref", "o3"]]]},
      {"name": "reverse", "line": 10, "vars": [["head", ["ref", "o3"]], ["prev", ["ref", "o4"]]]},
      {"name": "reverse", "line": 11, "vars": [["head", ["ref", "o3"]], ["prev", ["ref", "o4"]]]},
      {"name": "reverse", "line": 12, "vars": [["head", ["ref", "o3"]], ["prev", ["ref", "o4"]], ["next", ["none", "null"]]]},
      {"name": "reverse", "line": 13, "vars": [["head", ["ref", "o3"]], ["prev", ["ref", "o4"]], ["next", ["none", "null"]]]},
      {"name": "reverse", "line": 14, "vars": [["head", ["ref", "o3"]], ["prev", ["ref", "o3"]], ["next", ["none", "null"]]]},
      {"name": "reverse", "line": 10, "vars": [["head", ["none", "null"]], ["prev", ["ref", "o3"]]]},
      {"name": "reverse", "line": 16, "vars": [["head", ["none", "null"]], ["prev", ["ref", "o3"]]]},
      {"name": "reverse", "line": 16, "vars": [["head", ["none", "null"]], ["prev", ["ref", "o3"]], ["return value", ["ref", "o3"]]]},
      {"name": "Global", "line": 23, "vars": [["ListNode", ["ref", "o2"]], ["reverse", ["ref", "o1"]], ["head", ["ref", "o3"]]]},
    ],
    objects: [
      {"id": "o1", "k": "func", "name": "reverse", "params": "head"},
      {"id": "o2", "k": "class", "name": "ListNode"},
      {"id": "o3", "k": "obj", "cls": "ListNode", "fields": []},
      {"id": "o3", "k": "obj", "cls": "ListNode", "fields": [["val", ["int", "4"]]]},
      {"id": "o3", "k": "lnode", "cls": "ListNode", "fields": [["val", ["int", "4"]], ["next", ["none", "null"]]]},
      {"id": "o4", "k": "obj", "cls": "ListNode", "fields": []},
      {"id": "o4", "k": "obj", "cls": "ListNode", "fields": [["val", ["int", "3"]]]},
      {"id": "o4", "k": "lnode", "cls": "ListNode", "fields": [["val", ["int", "3"]], ["next", ["ref", "o3"]]]},
      {"id": "o5", "k": "obj", "cls": "ListNode", "fields": []},
      {"id": "o5", "k": "obj", "cls": "ListNode", "fields": [["val", ["int", "2"]]]},
      {"id": "o5", "k": "lnode", "cls": "ListNode", "fields": [["val", ["int", "2"]], ["next", ["ref", "o4"]]]},
      {"id": "o6", "k": "obj", "cls": "ListNode", "fields": []},
      {"id": "o6", "k": "obj", "cls": "ListNode", "fields": [["val", ["int", "1"]]]},
      {"id": "o6", "k": "lnode", "cls": "ListNode", "fields": [["val", ["int", "1"]], ["next", ["ref", "o5"]]]},
      {"id": "o6", "k": "lnode", "cls": "ListNode", "fields": [["val", ["int", "1"]], ["next", ["none", "null"]]]},
      {"id": "o5", "k": "lnode", "cls": "ListNode", "fields": [["val", ["int", "2"]], ["next", ["ref", "o6"]]]},
      {"id": "o4", "k": "lnode", "cls": "ListNode", "fields": [["val", ["int", "3"]], ["next", ["ref", "o5"]]]},
      {"id": "o3", "k": "lnode", "cls": "ListNode", "fields": [["val", ["int", "4"]], ["next", ["ref", "o4"]]]},
    ],
    steps: [
      [1, 0, [0], [0]],
      [19, 0, [1], [1, 0]],
      [20, 0, [2], [1, 0]],
      [21, 0, [3], [1, 0]],
      [3, 0, [3, 4], [1, 0, 2]],
      [4, 0, [3, 5], [1, 0, 3]],
      [4, 1, [3, 6], [1, 0, 4]],
      [20, 0, [7], [1, 0, 4]],
      [21, 0, [8], [1, 0, 4]],
      [3, 0, [8, 9], [1, 0, 4, 5]],
      [4, 0, [8, 10], [1, 0, 4, 6]],
      [4, 1, [8, 11], [1, 0, 4, 7]],
      [20, 0, [12], [1, 0, 7, 4]],
      [21, 0, [13], [1, 0, 7, 4]],
      [3, 0, [13, 14], [1, 0, 7, 8, 4]],
      [4, 0, [13, 15], [1, 0, 7, 9, 4]],
      [4, 1, [13, 16], [1, 0, 7, 10, 4]],
      [20, 0, [17], [1, 0, 10, 7, 4]],
      [21, 0, [18], [1, 0, 10, 7, 4]],
      [3, 0, [18, 19], [1, 0, 10, 11, 7, 4]],
      [4, 0, [18, 20], [1, 0, 10, 12, 7, 4]],
      [4, 1, [18, 21], [1, 0, 10, 13, 7, 4]],
      [23, 0, [22], [1, 0, 13, 10, 7, 4]],
      [9, 0, [22, 23], [1, 0, 13, 10, 7, 4]],
      [10, 0, [22, 24], [1, 0, 13, 10, 7, 4]],
      [11, 0, [22, 25], [1, 0, 13, 10, 7, 4]],
      [12, 0, [22, 26], [1, 0, 13, 10, 7, 4]],
      [13, 0, [22, 27], [1, 0, 14, 10, 7, 4]],
      [14, 0, [22, 28], [1, 0, 14, 10, 7, 4]],
      [10, 0, [22, 29], [1, 0, 14, 10, 7, 4]],
      [11, 0, [22, 30], [1, 0, 14, 10, 7, 4]],
      [12, 0, [22, 31], [1, 0, 14, 10, 7, 4]],
      [13, 0, [22, 32], [1, 0, 14, 15, 7, 4]],
      [14, 0, [22, 33], [1, 0, 14, 15, 7, 4]],
      [10, 0, [22, 34], [1, 0, 14, 7, 15, 4]],
      [11, 0, [22, 35], [1, 0, 14, 7, 15, 4]],
      [12, 0, [22, 36], [1, 0, 14, 7, 15, 4]],
      [13, 0, [22, 37], [1, 0, 14, 16, 15, 4]],
      [14, 0, [22, 38], [1, 0, 14, 16, 4, 15]],
      [10, 0, [22, 39], [1, 0, 14, 4, 16, 15]],
      [11, 0, [22, 40], [1, 0, 14, 4, 16, 15]],
      [12, 0, [22, 41], [1, 0, 14, 4, 16, 15]],
      [13, 0, [22, 42], [1, 0, 14, 17, 16, 15]],
      [14, 0, [22, 43], [1, 0, 14, 17, 16, 15]],
      [10, 0, [22, 44], [1, 0, 14, 17, 16, 15]],
      [16, 0, [22, 45], [1, 0, 14, 17, 16, 15]],
      [16, 1, [22, 46], [1, 0, 14, 17, 16, 15]],
      [null, 3, [47], [1, 0, 17, 16, 15, 14]],
    ],
  },
  {
    id: "tree",
    title: "Binary search tree",
    code: `class Node {
  constructor(val) {
    this.val = val;
    this.left = null;
    this.right = null;
  }
}

function insert(root, val) {
  const node = new Node(val);
  if (root === null) return node;
  let cur = root;
  while (true) {
    if (val < cur.val) {
      if (cur.left === null) {
        cur.left = node;
        return root;
      }
      cur = cur.left;
    } else {
      if (cur.right === null) {
        cur.right = node;
        return root;
      }
      cur = cur.right;
    }
  }
}

let root = null;
for (const val of [8, 3, 10, 1, 6, 14]) {
  root = insert(root, val);
}
`,
    frames: [
      {"name": "Global", "line": 1, "vars": [["insert", ["ref", "o1"]]]},
      {"name": "Global", "line": 30, "vars": [["Node", ["ref", "o2"]], ["insert", ["ref", "o1"]]]},
      {"name": "Global", "line": 31, "vars": [["Node", ["ref", "o2"]], ["insert", ["ref", "o1"]], ["root", ["none", "null"]], ["val", ["int", "8"]]]},
      {"name": "Global", "line": 32, "vars": [["Node", ["ref", "o2"]], ["insert", ["ref", "o1"]], ["root", ["none", "null"]], ["val", ["int", "8"]]]},
      {"name": "insert", "line": 10, "vars": [["root", ["none", "null"]], ["val", ["int", "8"]]]},
      {"name": "Node.constructor", "line": 3, "vars": [["val", ["int", "8"]], ["this", ["ref", "o3"]]]},
      {"name": "Node.constructor", "line": 4, "vars": [["val", ["int", "8"]], ["this", ["ref", "o3"]]]},
      {"name": "Node.constructor", "line": 5, "vars": [["val", ["int", "8"]], ["this", ["ref", "o3"]]]},
      {"name": "Node.constructor", "line": 5, "vars": [["val", ["int", "8"]], ["this", ["ref", "o3"]], ["return value", ["none", "undefined"]]]},
      {"name": "insert", "line": 11, "vars": [["root", ["none", "null"]], ["val", ["int", "8"]], ["node", ["ref", "o3"]]]},
      {"name": "insert", "line": 11, "vars": [["root", ["none", "null"]], ["val", ["int", "8"]], ["node", ["ref", "o3"]], ["return value", ["ref", "o3"]]]},
      {"name": "Global", "line": 31, "vars": [["Node", ["ref", "o2"]], ["insert", ["ref", "o1"]], ["root", ["ref", "o3"]], ["val", ["int", "3"]]]},
      {"name": "Global", "line": 32, "vars": [["Node", ["ref", "o2"]], ["insert", ["ref", "o1"]], ["root", ["ref", "o3"]], ["val", ["int", "3"]]]},
      {"name": "insert", "line": 10, "vars": [["root", ["ref", "o3"]], ["val", ["int", "3"]]]},
      {"name": "Node.constructor", "line": 3, "vars": [["val", ["int", "3"]], ["this", ["ref", "o4"]]]},
      {"name": "Node.constructor", "line": 4, "vars": [["val", ["int", "3"]], ["this", ["ref", "o4"]]]},
      {"name": "Node.constructor", "line": 5, "vars": [["val", ["int", "3"]], ["this", ["ref", "o4"]]]},
      {"name": "Node.constructor", "line": 5, "vars": [["val", ["int", "3"]], ["this", ["ref", "o4"]], ["return value", ["none", "undefined"]]]},
      {"name": "insert", "line": 11, "vars": [["root", ["ref", "o3"]], ["val", ["int", "3"]], ["node", ["ref", "o4"]]]},
      {"name": "insert", "line": 12, "vars": [["root", ["ref", "o3"]], ["val", ["int", "3"]], ["node", ["ref", "o4"]]]},
      {"name": "insert", "line": 13, "vars": [["root", ["ref", "o3"]], ["val", ["int", "3"]], ["node", ["ref", "o4"]], ["cur", ["ref", "o3"]]]},
      {"name": "insert", "line": 14, "vars": [["root", ["ref", "o3"]], ["val", ["int", "3"]], ["node", ["ref", "o4"]], ["cur", ["ref", "o3"]]]},
      {"name": "insert", "line": 15, "vars": [["root", ["ref", "o3"]], ["val", ["int", "3"]], ["node", ["ref", "o4"]], ["cur", ["ref", "o3"]]]},
      {"name": "insert", "line": 16, "vars": [["root", ["ref", "o3"]], ["val", ["int", "3"]], ["node", ["ref", "o4"]], ["cur", ["ref", "o3"]]]},
      {"name": "insert", "line": 17, "vars": [["root", ["ref", "o3"]], ["val", ["int", "3"]], ["node", ["ref", "o4"]], ["cur", ["ref", "o3"]]]},
      {"name": "insert", "line": 17, "vars": [["root", ["ref", "o3"]], ["val", ["int", "3"]], ["node", ["ref", "o4"]], ["cur", ["ref", "o3"]], ["return value", ["ref", "o3"]]]},
      {"name": "Global", "line": 31, "vars": [["Node", ["ref", "o2"]], ["insert", ["ref", "o1"]], ["root", ["ref", "o3"]], ["val", ["int", "10"]]]},
      {"name": "Global", "line": 32, "vars": [["Node", ["ref", "o2"]], ["insert", ["ref", "o1"]], ["root", ["ref", "o3"]], ["val", ["int", "10"]]]},
      {"name": "insert", "line": 10, "vars": [["root", ["ref", "o3"]], ["val", ["int", "10"]]]},
      {"name": "Node.constructor", "line": 3, "vars": [["val", ["int", "10"]], ["this", ["ref", "o5"]]]},
      {"name": "Node.constructor", "line": 4, "vars": [["val", ["int", "10"]], ["this", ["ref", "o5"]]]},
      {"name": "Node.constructor", "line": 5, "vars": [["val", ["int", "10"]], ["this", ["ref", "o5"]]]},
      {"name": "Node.constructor", "line": 5, "vars": [["val", ["int", "10"]], ["this", ["ref", "o5"]], ["return value", ["none", "undefined"]]]},
      {"name": "insert", "line": 11, "vars": [["root", ["ref", "o3"]], ["val", ["int", "10"]], ["node", ["ref", "o5"]]]},
      {"name": "insert", "line": 12, "vars": [["root", ["ref", "o3"]], ["val", ["int", "10"]], ["node", ["ref", "o5"]]]},
      {"name": "insert", "line": 13, "vars": [["root", ["ref", "o3"]], ["val", ["int", "10"]], ["node", ["ref", "o5"]], ["cur", ["ref", "o3"]]]},
      {"name": "insert", "line": 14, "vars": [["root", ["ref", "o3"]], ["val", ["int", "10"]], ["node", ["ref", "o5"]], ["cur", ["ref", "o3"]]]},
      {"name": "insert", "line": 21, "vars": [["root", ["ref", "o3"]], ["val", ["int", "10"]], ["node", ["ref", "o5"]], ["cur", ["ref", "o3"]]]},
      {"name": "insert", "line": 22, "vars": [["root", ["ref", "o3"]], ["val", ["int", "10"]], ["node", ["ref", "o5"]], ["cur", ["ref", "o3"]]]},
      {"name": "insert", "line": 23, "vars": [["root", ["ref", "o3"]], ["val", ["int", "10"]], ["node", ["ref", "o5"]], ["cur", ["ref", "o3"]]]},
      {"name": "insert", "line": 23, "vars": [["root", ["ref", "o3"]], ["val", ["int", "10"]], ["node", ["ref", "o5"]], ["cur", ["ref", "o3"]], ["return value", ["ref", "o3"]]]},
      {"name": "Global", "line": 31, "vars": [["Node", ["ref", "o2"]], ["insert", ["ref", "o1"]], ["root", ["ref", "o3"]], ["val", ["int", "1"]]]},
      {"name": "Global", "line": 32, "vars": [["Node", ["ref", "o2"]], ["insert", ["ref", "o1"]], ["root", ["ref", "o3"]], ["val", ["int", "1"]]]},
      {"name": "insert", "line": 10, "vars": [["root", ["ref", "o3"]], ["val", ["int", "1"]]]},
      {"name": "Node.constructor", "line": 3, "vars": [["val", ["int", "1"]], ["this", ["ref", "o6"]]]},
      {"name": "Node.constructor", "line": 4, "vars": [["val", ["int", "1"]], ["this", ["ref", "o6"]]]},
      {"name": "Node.constructor", "line": 5, "vars": [["val", ["int", "1"]], ["this", ["ref", "o6"]]]},
      {"name": "Node.constructor", "line": 5, "vars": [["val", ["int", "1"]], ["this", ["ref", "o6"]], ["return value", ["none", "undefined"]]]},
      {"name": "insert", "line": 11, "vars": [["root", ["ref", "o3"]], ["val", ["int", "1"]], ["node", ["ref", "o6"]]]},
      {"name": "insert", "line": 12, "vars": [["root", ["ref", "o3"]], ["val", ["int", "1"]], ["node", ["ref", "o6"]]]},
      {"name": "insert", "line": 13, "vars": [["root", ["ref", "o3"]], ["val", ["int", "1"]], ["node", ["ref", "o6"]], ["cur", ["ref", "o3"]]]},
      {"name": "insert", "line": 14, "vars": [["root", ["ref", "o3"]], ["val", ["int", "1"]], ["node", ["ref", "o6"]], ["cur", ["ref", "o3"]]]},
      {"name": "insert", "line": 15, "vars": [["root", ["ref", "o3"]], ["val", ["int", "1"]], ["node", ["ref", "o6"]], ["cur", ["ref", "o3"]]]},
      {"name": "insert", "line": 19, "vars": [["root", ["ref", "o3"]], ["val", ["int", "1"]], ["node", ["ref", "o6"]], ["cur", ["ref", "o3"]]]},
      {"name": "insert", "line": 13, "vars": [["root", ["ref", "o3"]], ["val", ["int", "1"]], ["node", ["ref", "o6"]], ["cur", ["ref", "o4"]]]},
      {"name": "insert", "line": 14, "vars": [["root", ["ref", "o3"]], ["val", ["int", "1"]], ["node", ["ref", "o6"]], ["cur", ["ref", "o4"]]]},
      {"name": "insert", "line": 15, "vars": [["root", ["ref", "o3"]], ["val", ["int", "1"]], ["node", ["ref", "o6"]], ["cur", ["ref", "o4"]]]},
      {"name": "insert", "line": 16, "vars": [["root", ["ref", "o3"]], ["val", ["int", "1"]], ["node", ["ref", "o6"]], ["cur", ["ref", "o4"]]]},
      {"name": "insert", "line": 17, "vars": [["root", ["ref", "o3"]], ["val", ["int", "1"]], ["node", ["ref", "o6"]], ["cur", ["ref", "o4"]]]},
      {"name": "insert", "line": 17, "vars": [["root", ["ref", "o3"]], ["val", ["int", "1"]], ["node", ["ref", "o6"]], ["cur", ["ref", "o4"]], ["return value", ["ref", "o3"]]]},
      {"name": "Global", "line": 31, "vars": [["Node", ["ref", "o2"]], ["insert", ["ref", "o1"]], ["root", ["ref", "o3"]], ["val", ["int", "6"]]]},
      {"name": "Global", "line": 32, "vars": [["Node", ["ref", "o2"]], ["insert", ["ref", "o1"]], ["root", ["ref", "o3"]], ["val", ["int", "6"]]]},
      {"name": "insert", "line": 10, "vars": [["root", ["ref", "o3"]], ["val", ["int", "6"]]]},
      {"name": "Node.constructor", "line": 3, "vars": [["val", ["int", "6"]], ["this", ["ref", "o7"]]]},
      {"name": "Node.constructor", "line": 4, "vars": [["val", ["int", "6"]], ["this", ["ref", "o7"]]]},
      {"name": "Node.constructor", "line": 5, "vars": [["val", ["int", "6"]], ["this", ["ref", "o7"]]]},
      {"name": "Node.constructor", "line": 5, "vars": [["val", ["int", "6"]], ["this", ["ref", "o7"]], ["return value", ["none", "undefined"]]]},
      {"name": "insert", "line": 11, "vars": [["root", ["ref", "o3"]], ["val", ["int", "6"]], ["node", ["ref", "o7"]]]},
      {"name": "insert", "line": 12, "vars": [["root", ["ref", "o3"]], ["val", ["int", "6"]], ["node", ["ref", "o7"]]]},
      {"name": "insert", "line": 13, "vars": [["root", ["ref", "o3"]], ["val", ["int", "6"]], ["node", ["ref", "o7"]], ["cur", ["ref", "o3"]]]},
      {"name": "insert", "line": 14, "vars": [["root", ["ref", "o3"]], ["val", ["int", "6"]], ["node", ["ref", "o7"]], ["cur", ["ref", "o3"]]]},
      {"name": "insert", "line": 15, "vars": [["root", ["ref", "o3"]], ["val", ["int", "6"]], ["node", ["ref", "o7"]], ["cur", ["ref", "o3"]]]},
      {"name": "insert", "line": 19, "vars": [["root", ["ref", "o3"]], ["val", ["int", "6"]], ["node", ["ref", "o7"]], ["cur", ["ref", "o3"]]]},
      {"name": "insert", "line": 13, "vars": [["root", ["ref", "o3"]], ["val", ["int", "6"]], ["node", ["ref", "o7"]], ["cur", ["ref", "o4"]]]},
      {"name": "insert", "line": 14, "vars": [["root", ["ref", "o3"]], ["val", ["int", "6"]], ["node", ["ref", "o7"]], ["cur", ["ref", "o4"]]]},
      {"name": "insert", "line": 21, "vars": [["root", ["ref", "o3"]], ["val", ["int", "6"]], ["node", ["ref", "o7"]], ["cur", ["ref", "o4"]]]},
      {"name": "insert", "line": 22, "vars": [["root", ["ref", "o3"]], ["val", ["int", "6"]], ["node", ["ref", "o7"]], ["cur", ["ref", "o4"]]]},
      {"name": "insert", "line": 23, "vars": [["root", ["ref", "o3"]], ["val", ["int", "6"]], ["node", ["ref", "o7"]], ["cur", ["ref", "o4"]]]},
      {"name": "insert", "line": 23, "vars": [["root", ["ref", "o3"]], ["val", ["int", "6"]], ["node", ["ref", "o7"]], ["cur", ["ref", "o4"]], ["return value", ["ref", "o3"]]]},
      {"name": "Global", "line": 31, "vars": [["Node", ["ref", "o2"]], ["insert", ["ref", "o1"]], ["root", ["ref", "o3"]], ["val", ["int", "14"]]]},
      {"name": "Global", "line": 32, "vars": [["Node", ["ref", "o2"]], ["insert", ["ref", "o1"]], ["root", ["ref", "o3"]], ["val", ["int", "14"]]]},
      {"name": "insert", "line": 10, "vars": [["root", ["ref", "o3"]], ["val", ["int", "14"]]]},
      {"name": "Node.constructor", "line": 3, "vars": [["val", ["int", "14"]], ["this", ["ref", "o8"]]]},
      {"name": "Node.constructor", "line": 4, "vars": [["val", ["int", "14"]], ["this", ["ref", "o8"]]]},
      {"name": "Node.constructor", "line": 5, "vars": [["val", ["int", "14"]], ["this", ["ref", "o8"]]]},
      {"name": "Node.constructor", "line": 5, "vars": [["val", ["int", "14"]], ["this", ["ref", "o8"]], ["return value", ["none", "undefined"]]]},
      {"name": "insert", "line": 11, "vars": [["root", ["ref", "o3"]], ["val", ["int", "14"]], ["node", ["ref", "o8"]]]},
      {"name": "insert", "line": 12, "vars": [["root", ["ref", "o3"]], ["val", ["int", "14"]], ["node", ["ref", "o8"]]]},
      {"name": "insert", "line": 13, "vars": [["root", ["ref", "o3"]], ["val", ["int", "14"]], ["node", ["ref", "o8"]], ["cur", ["ref", "o3"]]]},
      {"name": "insert", "line": 14, "vars": [["root", ["ref", "o3"]], ["val", ["int", "14"]], ["node", ["ref", "o8"]], ["cur", ["ref", "o3"]]]},
      {"name": "insert", "line": 21, "vars": [["root", ["ref", "o3"]], ["val", ["int", "14"]], ["node", ["ref", "o8"]], ["cur", ["ref", "o3"]]]},
      {"name": "insert", "line": 25, "vars": [["root", ["ref", "o3"]], ["val", ["int", "14"]], ["node", ["ref", "o8"]], ["cur", ["ref", "o3"]]]},
      {"name": "insert", "line": 13, "vars": [["root", ["ref", "o3"]], ["val", ["int", "14"]], ["node", ["ref", "o8"]], ["cur", ["ref", "o5"]]]},
      {"name": "insert", "line": 14, "vars": [["root", ["ref", "o3"]], ["val", ["int", "14"]], ["node", ["ref", "o8"]], ["cur", ["ref", "o5"]]]},
      {"name": "insert", "line": 21, "vars": [["root", ["ref", "o3"]], ["val", ["int", "14"]], ["node", ["ref", "o8"]], ["cur", ["ref", "o5"]]]},
      {"name": "insert", "line": 22, "vars": [["root", ["ref", "o3"]], ["val", ["int", "14"]], ["node", ["ref", "o8"]], ["cur", ["ref", "o5"]]]},
      {"name": "insert", "line": 23, "vars": [["root", ["ref", "o3"]], ["val", ["int", "14"]], ["node", ["ref", "o8"]], ["cur", ["ref", "o5"]]]},
      {"name": "insert", "line": 23, "vars": [["root", ["ref", "o3"]], ["val", ["int", "14"]], ["node", ["ref", "o8"]], ["cur", ["ref", "o5"]], ["return value", ["ref", "o3"]]]},
      {"name": "Global", "line": 32, "vars": [["Node", ["ref", "o2"]], ["insert", ["ref", "o1"]], ["root", ["ref", "o3"]]]},
    ],
    objects: [
      {"id": "o1", "k": "func", "name": "insert", "params": "root, val"},
      {"id": "o2", "k": "class", "name": "Node"},
      {"id": "o3", "k": "obj", "cls": "Node", "fields": []},
      {"id": "o3", "k": "obj", "cls": "Node", "fields": [["val", ["int", "8"]]]},
      {"id": "o3", "k": "obj", "cls": "Node", "fields": [["val", ["int", "8"]], ["left", ["none", "null"]]]},
      {"id": "o3", "k": "tnode", "cls": "Node", "fields": [["val", ["int", "8"]], ["left", ["none", "null"]], ["right", ["none", "null"]]]},
      {"id": "o4", "k": "obj", "cls": "Node", "fields": []},
      {"id": "o4", "k": "obj", "cls": "Node", "fields": [["val", ["int", "3"]]]},
      {"id": "o4", "k": "obj", "cls": "Node", "fields": [["val", ["int", "3"]], ["left", ["none", "null"]]]},
      {"id": "o4", "k": "tnode", "cls": "Node", "fields": [["val", ["int", "3"]], ["left", ["none", "null"]], ["right", ["none", "null"]]]},
      {"id": "o3", "k": "tnode", "cls": "Node", "fields": [["val", ["int", "8"]], ["left", ["ref", "o4"]], ["right", ["none", "null"]]]},
      {"id": "o5", "k": "obj", "cls": "Node", "fields": []},
      {"id": "o5", "k": "obj", "cls": "Node", "fields": [["val", ["int", "10"]]]},
      {"id": "o5", "k": "obj", "cls": "Node", "fields": [["val", ["int", "10"]], ["left", ["none", "null"]]]},
      {"id": "o5", "k": "tnode", "cls": "Node", "fields": [["val", ["int", "10"]], ["left", ["none", "null"]], ["right", ["none", "null"]]]},
      {"id": "o3", "k": "tnode", "cls": "Node", "fields": [["val", ["int", "8"]], ["left", ["ref", "o4"]], ["right", ["ref", "o5"]]]},
      {"id": "o6", "k": "obj", "cls": "Node", "fields": []},
      {"id": "o6", "k": "obj", "cls": "Node", "fields": [["val", ["int", "1"]]]},
      {"id": "o6", "k": "obj", "cls": "Node", "fields": [["val", ["int", "1"]], ["left", ["none", "null"]]]},
      {"id": "o6", "k": "tnode", "cls": "Node", "fields": [["val", ["int", "1"]], ["left", ["none", "null"]], ["right", ["none", "null"]]]},
      {"id": "o4", "k": "tnode", "cls": "Node", "fields": [["val", ["int", "3"]], ["left", ["ref", "o6"]], ["right", ["none", "null"]]]},
      {"id": "o7", "k": "obj", "cls": "Node", "fields": []},
      {"id": "o7", "k": "obj", "cls": "Node", "fields": [["val", ["int", "6"]]]},
      {"id": "o7", "k": "obj", "cls": "Node", "fields": [["val", ["int", "6"]], ["left", ["none", "null"]]]},
      {"id": "o7", "k": "tnode", "cls": "Node", "fields": [["val", ["int", "6"]], ["left", ["none", "null"]], ["right", ["none", "null"]]]},
      {"id": "o4", "k": "tnode", "cls": "Node", "fields": [["val", ["int", "3"]], ["left", ["ref", "o6"]], ["right", ["ref", "o7"]]]},
      {"id": "o8", "k": "obj", "cls": "Node", "fields": []},
      {"id": "o8", "k": "obj", "cls": "Node", "fields": [["val", ["int", "14"]]]},
      {"id": "o8", "k": "obj", "cls": "Node", "fields": [["val", ["int", "14"]], ["left", ["none", "null"]]]},
      {"id": "o8", "k": "tnode", "cls": "Node", "fields": [["val", ["int", "14"]], ["left", ["none", "null"]], ["right", ["none", "null"]]]},
      {"id": "o5", "k": "tnode", "cls": "Node", "fields": [["val", ["int", "10"]], ["left", ["none", "null"]], ["right", ["ref", "o8"]]]},
    ],
    steps: [
      [1, 0, [0], [0]],
      [30, 0, [1], [1, 0]],
      [31, 0, [2], [1, 0]],
      [32, 0, [3], [1, 0]],
      [10, 0, [3, 4], [1, 0]],
      [3, 0, [3, 4, 5], [1, 0, 2]],
      [4, 0, [3, 4, 6], [1, 0, 3]],
      [5, 0, [3, 4, 7], [1, 0, 4]],
      [5, 1, [3, 4, 8], [1, 0, 5]],
      [11, 0, [3, 9], [1, 0, 5]],
      [11, 1, [3, 10], [1, 0, 5]],
      [31, 0, [11], [1, 0, 5]],
      [32, 0, [12], [1, 0, 5]],
      [10, 0, [12, 13], [1, 0, 5]],
      [3, 0, [12, 13, 14], [1, 0, 5, 6]],
      [4, 0, [12, 13, 15], [1, 0, 5, 7]],
      [5, 0, [12, 13, 16], [1, 0, 5, 8]],
      [5, 1, [12, 13, 17], [1, 0, 5, 9]],
      [11, 0, [12, 18], [1, 0, 5, 9]],
      [12, 0, [12, 19], [1, 0, 5, 9]],
      [13, 0, [12, 20], [1, 0, 5, 9]],
      [14, 0, [12, 21], [1, 0, 5, 9]],
      [15, 0, [12, 22], [1, 0, 5, 9]],
      [16, 0, [12, 23], [1, 0, 5, 9]],
      [17, 0, [12, 24], [1, 0, 10, 9]],
      [17, 1, [12, 25], [1, 0, 10, 9]],
      [31, 0, [26], [1, 0, 10, 9]],
      [32, 0, [27], [1, 0, 10, 9]],
      [10, 0, [27, 28], [1, 0, 10, 9]],
      [3, 0, [27, 28, 29], [1, 0, 10, 11, 9]],
      [4, 0, [27, 28, 30], [1, 0, 10, 12, 9]],
      [5, 0, [27, 28, 31], [1, 0, 10, 13, 9]],
      [5, 1, [27, 28, 32], [1, 0, 10, 14, 9]],
      [11, 0, [27, 33], [1, 0, 10, 14, 9]],
      [12, 0, [27, 34], [1, 0, 10, 14, 9]],
      [13, 0, [27, 35], [1, 0, 10, 14, 9]],
      [14, 0, [27, 36], [1, 0, 10, 14, 9]],
      [21, 0, [27, 37], [1, 0, 10, 14, 9]],
      [22, 0, [27, 38], [1, 0, 10, 14, 9]],
      [23, 0, [27, 39], [1, 0, 15, 14, 9]],
      [23, 1, [27, 40], [1, 0, 15, 14, 9]],
      [31, 0, [41], [1, 0, 15, 9, 14]],
      [32, 0, [42], [1, 0, 15, 9, 14]],
      [10, 0, [42, 43], [1, 0, 15, 9, 14]],
      [3, 0, [42, 43, 44], [1, 0, 15, 16, 9, 14]],
      [4, 0, [42, 43, 45], [1, 0, 15, 17, 9, 14]],
      [5, 0, [42, 43, 46], [1, 0, 15, 18, 9, 14]],
      [5, 1, [42, 43, 47], [1, 0, 15, 19, 9, 14]],
      [11, 0, [42, 48], [1, 0, 15, 19, 9, 14]],
      [12, 0, [42, 49], [1, 0, 15, 19, 9, 14]],
      [13, 0, [42, 50], [1, 0, 15, 19, 9, 14]],
      [14, 0, [42, 51], [1, 0, 15, 19, 9, 14]],
      [15, 0, [42, 52], [1, 0, 15, 19, 9, 14]],
      [19, 0, [42, 53], [1, 0, 15, 19, 9, 14]],
      [13, 0, [42, 54], [1, 0, 15, 19, 9, 14]],
      [14, 0, [42, 55], [1, 0, 15, 19, 9, 14]],
      [15, 0, [42, 56], [1, 0, 15, 19, 9, 14]],
      [16, 0, [42, 57], [1, 0, 15, 19, 9, 14]],
      [17, 0, [42, 58], [1, 0, 15, 19, 20, 14]],
      [17, 1, [42, 59], [1, 0, 15, 19, 20, 14]],
      [31, 0, [60], [1, 0, 15, 20, 14, 19]],
      [32, 0, [61], [1, 0, 15, 20, 14, 19]],
      [10, 0, [61, 62], [1, 0, 15, 20, 14, 19]],
      [3, 0, [61, 62, 63], [1, 0, 15, 21, 20, 14, 19]],
      [4, 0, [61, 62, 64], [1, 0, 15, 22, 20, 14, 19]],
      [5, 0, [61, 62, 65], [1, 0, 15, 23, 20, 14, 19]],
      [5, 1, [61, 62, 66], [1, 0, 15, 24, 20, 14, 19]],
      [11, 0, [61, 67], [1, 0, 15, 24, 20, 14, 19]],
      [12, 0, [61, 68], [1, 0, 15, 24, 20, 14, 19]],
      [13, 0, [61, 69], [1, 0, 15, 24, 20, 14, 19]],
      [14, 0, [61, 70], [1, 0, 15, 24, 20, 14, 19]],
      [15, 0, [61, 71], [1, 0, 15, 24, 20, 14, 19]],
      [19, 0, [61, 72], [1, 0, 15, 24, 20, 14, 19]],
      [13, 0, [61, 73], [1, 0, 15, 24, 20, 14, 19]],
      [14, 0, [61, 74], [1, 0, 15, 24, 20, 14, 19]],
      [21, 0, [61, 75], [1, 0, 15, 24, 20, 14, 19]],
      [22, 0, [61, 76], [1, 0, 15, 24, 20, 14, 19]],
      [23, 0, [61, 77], [1, 0, 15, 24, 25, 14, 19]],
      [23, 1, [61, 78], [1, 0, 15, 24, 25, 14, 19]],
      [31, 0, [79], [1, 0, 15, 25, 14, 19, 24]],
      [32, 0, [80], [1, 0, 15, 25, 14, 19, 24]],
      [10, 0, [80, 81], [1, 0, 15, 25, 14, 19, 24]],
      [3, 0, [80, 81, 82], [1, 0, 15, 26, 25, 14, 19, 24]],
      [4, 0, [80, 81, 83], [1, 0, 15, 27, 25, 14, 19, 24]],
      [5, 0, [80, 81, 84], [1, 0, 15, 28, 25, 14, 19, 24]],
      [5, 1, [80, 81, 85], [1, 0, 15, 29, 25, 14, 19, 24]],
      [11, 0, [80, 86], [1, 0, 15, 29, 25, 14, 19, 24]],
      [12, 0, [80, 87], [1, 0, 15, 29, 25, 14, 19, 24]],
      [13, 0, [80, 88], [1, 0, 15, 29, 25, 14, 19, 24]],
      [14, 0, [80, 89], [1, 0, 15, 29, 25, 14, 19, 24]],
      [21, 0, [80, 90], [1, 0, 15, 29, 25, 14, 19, 24]],
      [25, 0, [80, 91], [1, 0, 15, 29, 25, 14, 19, 24]],
      [13, 0, [80, 92], [1, 0, 15, 29, 14, 25, 19, 24]],
      [14, 0, [80, 93], [1, 0, 15, 29, 14, 25, 19, 24]],
      [21, 0, [80, 94], [1, 0, 15, 29, 14, 25, 19, 24]],
      [22, 0, [80, 95], [1, 0, 15, 29, 14, 25, 19, 24]],
      [23, 0, [80, 96], [1, 0, 15, 29, 30, 25, 19, 24]],
      [23, 1, [80, 97], [1, 0, 15, 29, 30, 25, 19, 24]],
      [null, 3, [98], [1, 0, 15, 25, 30, 19, 24, 29]],
    ],
  },
];