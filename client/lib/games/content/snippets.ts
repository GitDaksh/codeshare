// Code Racer's snippets: real, working code in three languages and three
// lengths. Indentation is 2 spaces (JavaScript, TypeScript) or 4 (Python);
// the racer types everything except the indentation at the start of a line.

export type RacerLanguage = "javascript" | "python" | "typescript";
export type RacerLength = "short" | "medium" | "long";

export type Snippet = { title: string; code: string };

export const SNIPPETS: Record<RacerLanguage, Record<RacerLength, Snippet[]>> = {
  javascript: {
    short: [
      { title: "Sum an array", code: "const sum = (nums) => nums.reduce((a, b) => a + b, 0);\nconsole.log(sum([1, 2, 3, 4]));" },
      { title: "Unique values", code: "const unique = (items) => [...new Set(items)];\nconsole.log(unique([3, 1, 3, 2, 1]));" },
      { title: "Is it even?", code: "function isEven(n) {\n  return n % 2 === 0;\n}" },
      { title: "Sleep", code: "const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));\nsleep(500).then(() => console.log(\"done\"));" },
      { title: "First and last", code: "const first = (items) => items[0];\nconst last = (items) => items[items.length - 1];" },
    ],
    medium: [
      { title: "Debounce", code: "function debounce(fn, wait) {\n  let timer;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), wait);\n  };\n}" },
      { title: "FizzBuzz", code: "for (let i = 1; i <= 15; i++) {\n  let out = \"\";\n  if (i % 3 === 0) out += \"Fizz\";\n  if (i % 5 === 0) out += \"Buzz\";\n  console.log(out || i);\n}" },
      { title: "Fetch JSON", code: "async function getUser(id) {\n  const res = await fetch(`/api/users/${id}`);\n  if (!res.ok) throw new Error(\"Request failed\");\n  return res.json();\n}" },
      { title: "Group by", code: "function groupBy(items, key) {\n  return items.reduce((groups, item) => {\n    (groups[item[key]] ??= []).push(item);\n    return groups;\n  }, {});\n}" },
      { title: "Title case", code: "const titleCase = (text) =>\n  text\n    .split(\" \")\n    .map((word) => word[0].toUpperCase() + word.slice(1))\n    .join(\" \");" },
    ],
    long: [
      { title: "Binary search", code: "function binarySearch(items, target) {\n  let low = 0;\n  let high = items.length - 1;\n  while (low <= high) {\n    const mid = Math.floor((low + high) / 2);\n    if (items[mid] === target) return mid;\n    if (items[mid] < target) low = mid + 1;\n    else high = mid - 1;\n  }\n  return -1;\n}" },
      { title: "Memoize", code: "function memoize(fn) {\n  const cache = new Map();\n  return function (...args) {\n    const key = JSON.stringify(args);\n    if (cache.has(key)) {\n      return cache.get(key);\n    }\n    const value = fn.apply(this, args);\n    cache.set(key, value);\n    return value;\n  };\n}" },
      { title: "A stack", code: "class Stack {\n  #items = [];\n\n  push(item) {\n    this.#items.push(item);\n  }\n\n  pop() {\n    return this.#items.pop();\n  }\n\n  get size() {\n    return this.#items.length;\n  }\n}" },
      { title: "Quicksort", code: "function quickSort(items) {\n  if (items.length <= 1) return items;\n  const [pivot, ...rest] = items;\n  const left = rest.filter((x) => x < pivot);\n  const right = rest.filter((x) => x >= pivot);\n  return [...quickSort(left), pivot, ...quickSort(right)];\n}\n\nconsole.log(quickSort([5, 3, 8, 1, 9, 2]));" },
      { title: "Event emitter", code: "class Emitter {\n  constructor() {\n    this.listeners = {};\n  }\n\n  on(event, handler) {\n    (this.listeners[event] ??= []).push(handler);\n  }\n\n  emit(event, ...args) {\n    for (const handler of this.listeners[event] ?? []) {\n      handler(...args);\n    }\n  }\n}" },
    ],
  },
  python: {
    short: [
      { title: "Sum of squares", code: "squares = [n * n for n in range(10)]\nprint(sum(squares))" },
      { title: "Palindrome", code: "def is_palindrome(text):\n    return text == text[::-1]" },
      { title: "Word counts", code: "counts = {}\nfor word in \"the cat and the hat\".split():\n    counts[word] = counts.get(word, 0) + 1" },
      { title: "Say hello", code: "name = input(\"Name: \")\nprint(f\"Hello, {name}!\")" },
      { title: "Even numbers", code: "evens = list(filter(lambda n: n % 2 == 0, range(20)))\nprint(evens)" },
    ],
    medium: [
      { title: "FizzBuzz", code: "for i in range(1, 16):\n    if i % 15 == 0:\n        print(\"FizzBuzz\")\n    elif i % 3 == 0:\n        print(\"Fizz\")\n    elif i % 5 == 0:\n        print(\"Buzz\")\n    else:\n        print(i)" },
      { title: "Fibonacci", code: "def fibonacci(limit):\n    a, b = 0, 1\n    while a < limit:\n        yield a\n        a, b = b, a + b\n\nprint(list(fibonacci(100)))" },
      { title: "Count lines", code: "def count_lines(path):\n    with open(path) as file:\n        return sum(1 for line in file if line.strip())" },
      { title: "A data class", code: "from dataclasses import dataclass\n\n@dataclass\nclass Point:\n    x: float\n    y: float\n\n    def distance(self):\n        return (self.x ** 2 + self.y ** 2) ** 0.5" },
      { title: "Two sum", code: "def two_sum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        if target - num in seen:\n            return [seen[target - num], i]\n        seen[num] = i\n    return []" },
    ],
    long: [
      { title: "Binary search", code: "def binary_search(items, target):\n    low, high = 0, len(items) - 1\n    while low <= high:\n        mid = (low + high) // 2\n        if items[mid] == target:\n            return mid\n        if items[mid] < target:\n            low = mid + 1\n        else:\n            high = mid - 1\n    return -1" },
      { title: "Shortest path", code: "from collections import deque\n\ndef shortest_path(graph, start, goal):\n    queue = deque([(start, [start])])\n    visited = {start}\n    while queue:\n        node, path = queue.popleft()\n        if node == goal:\n            return path\n        for neighbor in graph[node]:\n            if neighbor not in visited:\n                visited.add(neighbor)\n                queue.append((neighbor, path + [neighbor]))\n    return None" },
      { title: "A stack", code: "class Stack:\n    def __init__(self):\n        self.items = []\n\n    def push(self, item):\n        self.items.append(item)\n\n    def pop(self):\n        if not self.items:\n            raise IndexError(\"pop from empty stack\")\n        return self.items.pop()\n\n    def __len__(self):\n        return len(self.items)" },
      { title: "Merge sort", code: "def merge_sort(items):\n    if len(items) <= 1:\n        return items\n    mid = len(items) // 2\n    left = merge_sort(items[:mid])\n    right = merge_sort(items[mid:])\n    merged = []\n    while left and right:\n        merged.append(left.pop(0) if left[0] <= right[0] else right.pop(0))\n    return merged + left + right" },
      { title: "A timing decorator", code: "import time\nfrom functools import wraps\n\ndef timed(fn):\n    @wraps(fn)\n    def wrapper(*args, **kwargs):\n        start = time.perf_counter()\n        result = fn(*args, **kwargs)\n        elapsed = time.perf_counter() - start\n        print(f\"{fn.__name__} took {elapsed:.3f}s\")\n        return result\n    return wrapper" },
    ],
  },
  typescript: {
    short: [
      { title: "Typed add", code: "const add = (a: number, b: number): number => a + b;\nconsole.log(add(2, 3));" },
      { title: "A union type", code: "type Status = \"idle\" | \"loading\" | \"done\";\nlet status: Status = \"idle\";" },
      { title: "Generic first", code: "function first<T>(items: T[]): T | undefined {\n  return items[0];\n}" },
      { title: "Sorted ids", code: "const ids: number[] = [3, 1, 2];\nids.sort((a, b) => a - b);" },
      { title: "An interface", code: "interface Point {\n  x: number;\n  y: number;\n}" },
    ],
    medium: [
      { title: "A user", code: "interface User {\n  id: number;\n  name: string;\n  email?: string;\n}\n\nconst greet = (user: User) => `Hi, ${user.name}!`;" },
      { title: "Clamp", code: "function clamp(value: number, min: number, max: number) {\n  return Math.min(Math.max(value, min), max);\n}\n\nconst volume = clamp(120, 0, 100);" },
      { title: "An enum", code: "enum Direction {\n  Up,\n  Down,\n  Left,\n  Right,\n}\n\nlet heading: Direction = Direction.Up;" },
      { title: "Typed fetch", code: "async function load<T>(url: string): Promise<T> {\n  const res = await fetch(url);\n  if (!res.ok) throw new Error(res.statusText);\n  return (await res.json()) as T;\n}" },
      { title: "Counting words", code: "const counts = new Map<string, number>();\nfor (const word of \"a b a c b a\".split(\" \")) {\n  counts.set(word, (counts.get(word) ?? 0) + 1);\n}" },
    ],
    long: [
      { title: "A queue", code: "class Queue<T> {\n  private items: T[] = [];\n\n  enqueue(item: T): void {\n    this.items.push(item);\n  }\n\n  dequeue(): T | undefined {\n    return this.items.shift();\n  }\n\n  get size(): number {\n    return this.items.length;\n  }\n}" },
      { title: "A result type", code: "type Result<T> = { ok: true; value: T } | { ok: false; error: string };\n\nfunction parseAge(input: string): Result<number> {\n  const age = Number(input);\n  if (Number.isNaN(age) || age < 0) {\n    return { ok: false, error: \"Not a valid age\" };\n  }\n  return { ok: true, value: age };\n}\n\nconst result = parseAge(\"42\");" },
      { title: "Typed debounce", code: "function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number) {\n  let timer: ReturnType<typeof setTimeout> | undefined;\n  return (...args: A) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), wait);\n  };\n}\n\nconst save = debounce((text: string) => console.log(text), 300);" },
      { title: "A reducer", code: "type Action = { type: \"add\"; amount: number } | { type: \"reset\" };\n\nfunction reducer(total: number, action: Action): number {\n  switch (action.type) {\n    case \"add\":\n      return total + action.amount;\n    case \"reset\":\n      return 0;\n  }\n}\n\nconsole.log(reducer(10, { type: \"add\", amount: 5 }));" },
      { title: "Reverse a list", code: "class ListNode {\n  constructor(public value: number, public next: ListNode | null = null) {}\n}\n\nfunction reverse(head: ListNode | null): ListNode | null {\n  let prev: ListNode | null = null;\n  while (head) {\n    const next = head.next;\n    head.next = prev;\n    prev = head;\n    head = next;\n  }\n  return prev;\n}" },
    ],
  },
};
