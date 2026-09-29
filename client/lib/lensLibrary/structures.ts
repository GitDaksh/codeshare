import type { LensConcept } from "./index";

// Stacks & queues, linked lists and heaps.

export const STRUCTURE_CONCEPTS: LensConcept[] = [
  {
    id: "valid-parentheses",
    title: "Valid parentheses",
    category: "stacks",
    summary: "Push every opening bracket; each closing bracket must match the one on top of the stack.",
    complexity: "O(n)",
    code: {
      python: `def is_valid(text):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for ch in text:
        if ch in pairs:
            if not stack or stack.pop() != pairs[ch]:
                return False
        else:
            stack.append(ch)
    return not stack


print(is_valid("{[()()]}"))
print(is_valid("([)]"))
`,
      javascript: `function isValid(text) {
  const pairs = { ")": "(", "]": "[", "}": "{" };
  const stack = [];
  for (const ch of text) {
    if (ch in pairs) {
      if (stack.length === 0 || stack.pop() !== pairs[ch]) {
        return false;
      }
    } else {
      stack.push(ch);
    }
  }
  return stack.length === 0;
}

console.log(isValid("{[()()]}"));
console.log(isValid("([)]"));
`,
      typescript: `function isValid(text: string): boolean {
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: string[] = [];
  for (const ch of text) {
    if (ch in pairs) {
      if (stack.length === 0 || stack.pop() !== pairs[ch]) {
        return false;
      }
    } else {
      stack.push(ch);
    }
  }
  return stack.length === 0;
}

console.log(isValid("{[()()]}"));
console.log(isValid("([)]"));
`,
    },
  },
  {
    id: "next-greater",
    title: "Next greater element",
    category: "stacks",
    summary: "A monotonic stack holds indexes still waiting for a bigger number to their right.",
    complexity: "O(n)",
    code: {
      python: `def next_greater(nums):
    result = [-1] * len(nums)
    stack = []
    for i in range(len(nums)):
        while stack and nums[stack[-1]] < nums[i]:
            result[stack.pop()] = nums[i]
        stack.append(i)
    return result


print(next_greater([2, 1, 2, 4, 3, 1]))
`,
      javascript: `function nextGreater(nums) {
  const result = new Array(nums.length).fill(-1);
  const stack = [];
  for (let i = 0; i < nums.length; i++) {
    while (stack.length > 0 && nums[stack[stack.length - 1]] < nums[i]) {
      result[stack.pop()] = nums[i];
    }
    stack.push(i);
  }
  return result;
}

console.log(nextGreater([2, 1, 2, 4, 3, 1]));
`,
      typescript: `function nextGreater(nums: number[]): number[] {
  const result: number[] = new Array(nums.length).fill(-1);
  const stack: number[] = [];
  for (let i = 0; i < nums.length; i++) {
    while (stack.length > 0 && nums[stack[stack.length - 1]] < nums[i]) {
      result[stack.pop()!] = nums[i];
    }
    stack.push(i);
  }
  return result;
}

console.log(nextGreater([2, 1, 2, 4, 3, 1]));
`,
    },
  },
  {
    id: "rpn",
    title: "Reverse Polish notation",
    category: "stacks",
    summary: "Numbers go on a stack; each operator pops two, combines them and pushes the result.",
    complexity: "O(n)",
    code: {
      python: `def evaluate(tokens):
    stack = []
    for token in tokens:
        if token in ("+", "-", "*"):
            b = stack.pop()
            a = stack.pop()
            if token == "+":
                stack.append(a + b)
            elif token == "-":
                stack.append(a - b)
            else:
                stack.append(a * b)
        else:
            stack.append(int(token))
    return stack[0]


print(evaluate(["3", "4", "+", "2", "*", "7", "-"]))
`,
      javascript: `function evaluate(tokens) {
  const stack = [];
  for (const token of tokens) {
    if (token === "+" || token === "-" || token === "*") {
      const b = stack.pop();
      const a = stack.pop();
      if (token === "+") {
        stack.push(a + b);
      } else if (token === "-") {
        stack.push(a - b);
      } else {
        stack.push(a * b);
      }
    } else {
      stack.push(Number(token));
    }
  }
  return stack[0];
}

console.log(evaluate(["3", "4", "+", "2", "*", "7", "-"]));
`,
      typescript: `function evaluate(tokens: string[]): number {
  const stack: number[] = [];
  for (const token of tokens) {
    if (token === "+" || token === "-" || token === "*") {
      const b = stack.pop()!;
      const a = stack.pop()!;
      if (token === "+") {
        stack.push(a + b);
      } else if (token === "-") {
        stack.push(a - b);
      } else {
        stack.push(a * b);
      }
    } else {
      stack.push(Number(token));
    }
  }
  return stack[0];
}

console.log(evaluate(["3", "4", "+", "2", "*", "7", "-"]));
`,
    },
  },
  {
    id: "linked-list",
    title: "Reverse a linked list",
    category: "linked",
    summary: "Walk the list once, turning every next pointer around.",
    complexity: "O(n)",
    code: {
      python: `class ListNode:
    def __init__(self, val, next=None):
        self.val = val
        self.next = next


def reverse(head):
    prev = None
    while head:
        nxt = head.next
        head.next = prev
        prev = head
        head = nxt
    return prev


head = ListNode(1, ListNode(2, ListNode(3, ListNode(4))))
head = reverse(head)
`,
      javascript: `class ListNode {
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
      typescript: `class ListNode {
  val: number;
  next: ListNode | null;

  constructor(val: number, next: ListNode | null = null) {
    this.val = val;
    this.next = next;
  }
}

function reverse(head: ListNode | null): ListNode | null {
  let prev: ListNode | null = null;
  while (head) {
    const next = head.next;
    head.next = prev;
    prev = head;
    head = next;
  }
  return prev;
}

let head: ListNode | null = null;
for (const value of [4, 3, 2, 1]) {
  head = new ListNode(value, head);
}
head = reverse(head);
`,
    },
  },
  {
    id: "middle-node",
    title: "Middle node (slow & fast)",
    category: "linked",
    summary: "The fast pointer moves two nodes for every one the slow pointer moves.",
    complexity: "O(n)",
    code: {
      python: `class ListNode:
    def __init__(self, val, next=None):
        self.val = val
        self.next = next


def middle(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
    return slow


head = None
for val in [5, 4, 3, 2, 1]:
    head = ListNode(val, head)
print(middle(head).val)
`,
      javascript: `class ListNode {
  constructor(val, next = null) {
    this.val = val;
    this.next = next;
  }
}

function middle(head) {
  let slow = head;
  let fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
  }
  return slow;
}

let head = null;
for (const val of [5, 4, 3, 2, 1]) {
  head = new ListNode(val, head);
}
console.log(middle(head).val);
`,
      typescript: `class ListNode {
  val: number;
  next: ListNode | null;

  constructor(val: number, next: ListNode | null = null) {
    this.val = val;
    this.next = next;
  }
}

function middle(head: ListNode | null): ListNode | null {
  let slow = head;
  let fast = head;
  while (fast && fast.next) {
    slow = slow!.next;
    fast = fast.next.next;
  }
  return slow;
}

let head: ListNode | null = null;
for (const val of [5, 4, 3, 2, 1]) {
  head = new ListNode(val, head);
}
console.log(middle(head)!.val);
`,
    },
  },
  {
    id: "detect-cycle",
    title: "Detect a cycle",
    category: "linked",
    summary: "Floyd's tortoise and hare: in a loop, the fast pointer always catches the slow one.",
    complexity: "O(n)",
    code: {
      python: `class ListNode:
    def __init__(self, val):
        self.val = val
        self.next = None


def has_cycle(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow is fast:
            return True
    return False


head = tail = ListNode(1)
for val in [2, 3, 4, 5]:
    tail.next = ListNode(val)
    tail = tail.next
tail.next = head.next.next
print(has_cycle(head))
`,
      javascript: `class ListNode {
  constructor(val) {
    this.val = val;
    this.next = null;
  }
}

function hasCycle(head) {
  let slow = head;
  let fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) {
      return true;
    }
  }
  return false;
}

const head = new ListNode(1);
let tail = head;
for (const val of [2, 3, 4, 5]) {
  tail.next = new ListNode(val);
  tail = tail.next;
}
tail.next = head.next.next;
console.log(hasCycle(head));
`,
      typescript: `class ListNode {
  val: number;
  next: ListNode | null = null;

  constructor(val: number) {
    this.val = val;
  }
}

function hasCycle(head: ListNode | null): boolean {
  let slow = head;
  let fast = head;
  while (fast && fast.next) {
    slow = slow!.next;
    fast = fast.next.next;
    if (slow === fast) {
      return true;
    }
  }
  return false;
}

const head = new ListNode(1);
let tail = head;
for (const val of [2, 3, 4, 5]) {
  tail.next = new ListNode(val);
  tail = tail.next;
}
tail.next = head.next!.next;
console.log(hasCycle(head));
`,
    },
  },
  {
    id: "merge-lists",
    title: "Merge two sorted lists",
    category: "linked",
    summary: "Relink nodes from two sorted lists into one, always taking the smaller head.",
    complexity: "O(n + m)",
    code: {
      python: `class ListNode:
    def __init__(self, val, next=None):
        self.val = val
        self.next = next


def merge(a, b):
    dummy = tail = ListNode(0)
    while a and b:
        if a.val <= b.val:
            tail.next = a
            a = a.next
        else:
            tail.next = b
            b = b.next
        tail = tail.next
    tail.next = a or b
    return dummy.next


a = ListNode(1, ListNode(4, ListNode(7)))
b = ListNode(2, ListNode(3, ListNode(8)))
node = merge(a, b)
values = []
while node:
    values.append(node.val)
    node = node.next
print(values)
`,
      javascript: `class ListNode {
  constructor(val, next = null) {
    this.val = val;
    this.next = next;
  }
}

function merge(a, b) {
  const dummy = new ListNode(0);
  let tail = dummy;
  while (a && b) {
    if (a.val <= b.val) {
      tail.next = a;
      a = a.next;
    } else {
      tail.next = b;
      b = b.next;
    }
    tail = tail.next;
  }
  tail.next = a || b;
  return dummy.next;
}

const a = new ListNode(1, new ListNode(4, new ListNode(7)));
const b = new ListNode(2, new ListNode(3, new ListNode(8)));
let node = merge(a, b);
const values = [];
while (node) {
  values.push(node.val);
  node = node.next;
}
console.log(values);
`,
      typescript: `class ListNode {
  val: number;
  next: ListNode | null;

  constructor(val: number, next: ListNode | null = null) {
    this.val = val;
    this.next = next;
  }
}

function merge(a: ListNode | null, b: ListNode | null): ListNode | null {
  const dummy = new ListNode(0);
  let tail = dummy;
  while (a && b) {
    if (a.val <= b.val) {
      tail.next = a;
      a = a.next;
    } else {
      tail.next = b;
      b = b.next;
    }
    tail = tail.next;
  }
  tail.next = a || b;
  return dummy.next;
}

const a = new ListNode(1, new ListNode(4, new ListNode(7)));
const b = new ListNode(2, new ListNode(3, new ListNode(8)));
let node = merge(a, b);
const values: number[] = [];
while (node) {
  values.push(node.val);
  node = node.next;
}
console.log(values);
`,
    },
  },
  {
    id: "min-heap",
    title: "Min-heap",
    category: "heaps",
    summary: "An array that behaves like a tree: new values sift up, and the smallest is always at index 0.",
    complexity: "O(log n) per push or pop",
    code: {
      python: `class MinHeap:
    def __init__(self):
        self.items = []

    def push(self, value):
        items = self.items
        items.append(value)
        child = len(items) - 1
        while child > 0:
            parent = (child - 1) // 2
            if items[parent] <= items[child]:
                break
            items[parent], items[child] = items[child], items[parent]
            child = parent

    def pop(self):
        items = self.items
        top = items[0]
        last = items.pop()
        if items:
            items[0] = last
            parent = 0
            while True:
                smallest = parent
                for child in (2 * parent + 1, 2 * parent + 2):
                    if child < len(items) and items[child] < items[smallest]:
                        smallest = child
                if smallest == parent:
                    break
                items[parent], items[smallest] = items[smallest], items[parent]
                parent = smallest
        return top


heap = MinHeap()
for value in [5, 3, 8, 1, 9, 2]:
    heap.push(value)
print([heap.pop(), heap.pop(), heap.pop()])
`,
      javascript: `class MinHeap {
  constructor() {
    this.items = [];
  }

  push(value) {
    const items = this.items;
    items.push(value);
    let child = items.length - 1;
    while (child > 0) {
      const parent = Math.floor((child - 1) / 2);
      if (items[parent] <= items[child]) {
        break;
      }
      [items[parent], items[child]] = [items[child], items[parent]];
      child = parent;
    }
  }

  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0) {
      items[0] = last;
      let parent = 0;
      while (true) {
        let smallest = parent;
        for (const child of [2 * parent + 1, 2 * parent + 2]) {
          if (child < items.length && items[child] < items[smallest]) {
            smallest = child;
          }
        }
        if (smallest === parent) {
          break;
        }
        [items[parent], items[smallest]] = [items[smallest], items[parent]];
        parent = smallest;
      }
    }
    return top;
  }
}

const heap = new MinHeap();
for (const value of [5, 3, 8, 1, 9, 2]) {
  heap.push(value);
}
console.log([heap.pop(), heap.pop(), heap.pop()]);
`,
      typescript: `class MinHeap {
  items: number[] = [];

  push(value: number): void {
    const items = this.items;
    items.push(value);
    let child = items.length - 1;
    while (child > 0) {
      const parent = Math.floor((child - 1) / 2);
      if (items[parent] <= items[child]) {
        break;
      }
      [items[parent], items[child]] = [items[child], items[parent]];
      child = parent;
    }
  }

  pop(): number {
    const items = this.items;
    const top = items[0];
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let parent = 0;
      while (true) {
        let smallest = parent;
        for (const child of [2 * parent + 1, 2 * parent + 2]) {
          if (child < items.length && items[child] < items[smallest]) {
            smallest = child;
          }
        }
        if (smallest === parent) {
          break;
        }
        [items[parent], items[smallest]] = [items[smallest], items[parent]];
        parent = smallest;
      }
    }
    return top;
  }
}

const heap = new MinHeap();
for (const value of [5, 3, 8, 1, 9, 2]) {
  heap.push(value);
}
console.log([heap.pop(), heap.pop(), heap.pop()]);
`,
    },
  },
];