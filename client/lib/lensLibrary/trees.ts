import type { LensConcept } from "./index";

// Trees and graphs.

export const TREE_CONCEPTS: LensConcept[] = [
  {
    id: "tree",
    title: "Binary search tree",
    category: "trees",
    summary: "Insert values left or right of each node, then read them back in sorted order.",
    complexity: "O(h) per insert",
    code: {
      python: `class TreeNode:
    def __init__(self, val):
        self.val = val
        self.left = None
        self.right = None


def insert(root, val):
    if root is None:
        return TreeNode(val)
    if val < root.val:
        root.left = insert(root.left, val)
    else:
        root.right = insert(root.right, val)
    return root


def in_order(node, out):
    if node:
        in_order(node.left, out)
        out.append(node.val)
        in_order(node.right, out)
    return out


root = None
for value in [8, 3, 10, 1, 6, 14]:
    root = insert(root, value)

print(in_order(root, []))
`,
      javascript: `class TreeNode {
  constructor(val) {
    this.val = val;
    this.left = null;
    this.right = null;
  }
}

function insert(root, val) {
  if (root === null) {
    return new TreeNode(val);
  }
  if (val < root.val) {
    root.left = insert(root.left, val);
  } else {
    root.right = insert(root.right, val);
  }
  return root;
}

function inOrder(node, out) {
  if (node) {
    inOrder(node.left, out);
    out.push(node.val);
    inOrder(node.right, out);
  }
  return out;
}

let root = null;
for (const value of [8, 3, 10, 1, 6, 14]) {
  root = insert(root, value);
}

console.log(inOrder(root, []));
`,
      typescript: `class TreeNode {
  left: TreeNode | null = null;
  right: TreeNode | null = null;

  constructor(public val: number) {}
}

function insert(root: TreeNode | null, val: number): TreeNode {
  if (root === null) {
    return new TreeNode(val);
  }
  if (val < root.val) {
    root.left = insert(root.left, val);
  } else {
    root.right = insert(root.right, val);
  }
  return root;
}

function inOrder(node: TreeNode | null, out: number[]): number[] {
  if (node) {
    inOrder(node.left, out);
    out.push(node.val);
    inOrder(node.right, out);
  }
  return out;
}

let root: TreeNode | null = null;
for (const value of [8, 3, 10, 1, 6, 14]) {
  root = insert(root, value);
}

console.log(inOrder(root, []));
`,
    },
  },
  {
    id: "traversals",
    title: "Tree traversals",
    category: "trees",
    summary: "Pre-order, in-order and post-order: the same recursion, visiting the node at a different moment.",
    complexity: "O(n)",
    code: {
      python: `class TreeNode:
    def __init__(self, val, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right


def preorder(node, out):
    if node:
        out.append(node.val)
        preorder(node.left, out)
        preorder(node.right, out)
    return out


def inorder(node, out):
    if node:
        inorder(node.left, out)
        out.append(node.val)
        inorder(node.right, out)
    return out


def postorder(node, out):
    if node:
        postorder(node.left, out)
        postorder(node.right, out)
        out.append(node.val)
    return out


root = TreeNode(
    4,
    TreeNode(2, TreeNode(1), TreeNode(3)),
    TreeNode(6, TreeNode(5), TreeNode(7)),
)
print(preorder(root, []))
print(inorder(root, []))
print(postorder(root, []))
`,
      javascript: `class TreeNode {
  constructor(val, left = null, right = null) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}

function preorder(node, out) {
  if (node) {
    out.push(node.val);
    preorder(node.left, out);
    preorder(node.right, out);
  }
  return out;
}

function inorder(node, out) {
  if (node) {
    inorder(node.left, out);
    out.push(node.val);
    inorder(node.right, out);
  }
  return out;
}

function postorder(node, out) {
  if (node) {
    postorder(node.left, out);
    postorder(node.right, out);
    out.push(node.val);
  }
  return out;
}

const root = new TreeNode(
  4,
  new TreeNode(2, new TreeNode(1), new TreeNode(3)),
  new TreeNode(6, new TreeNode(5), new TreeNode(7)),
);
console.log(preorder(root, []));
console.log(inorder(root, []));
console.log(postorder(root, []));
`,
      typescript: `class TreeNode {
  constructor(
    public val: number,
    public left: TreeNode | null = null,
    public right: TreeNode | null = null,
  ) {}
}

function preorder(node: TreeNode | null, out: number[]): number[] {
  if (node) {
    out.push(node.val);
    preorder(node.left, out);
    preorder(node.right, out);
  }
  return out;
}

function inorder(node: TreeNode | null, out: number[]): number[] {
  if (node) {
    inorder(node.left, out);
    out.push(node.val);
    inorder(node.right, out);
  }
  return out;
}

function postorder(node: TreeNode | null, out: number[]): number[] {
  if (node) {
    postorder(node.left, out);
    postorder(node.right, out);
    out.push(node.val);
  }
  return out;
}

const root = new TreeNode(
  4,
  new TreeNode(2, new TreeNode(1), new TreeNode(3)),
  new TreeNode(6, new TreeNode(5), new TreeNode(7)),
);
console.log(preorder(root, []));
console.log(inorder(root, []));
console.log(postorder(root, []));
`,
    },
  },
  {
    id: "level-order",
    title: "Level-order traversal",
    category: "trees",
    summary: "A queue visits the tree one level at a time, left to right.",
    complexity: "O(n)",
    code: {
      python: `from collections import deque


class TreeNode:
    def __init__(self, val, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right


def level_order(root):
    levels = []
    queue = deque([root])
    while queue:
        level = []
        for _ in range(len(queue)):
            node = queue.popleft()
            level.append(node.val)
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
        levels.append(level)
    return levels


root = TreeNode(3, TreeNode(9), TreeNode(20, TreeNode(15), TreeNode(7)))
print(level_order(root))
`,
      javascript: `class TreeNode {
  constructor(val, left = null, right = null) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}

function levelOrder(root) {
  const levels = [];
  const queue = [root];
  while (queue.length > 0) {
    const level = [];
    const size = queue.length;
    for (let n = 0; n < size; n++) {
      const node = queue.shift();
      level.push(node.val);
      if (node.left) {
        queue.push(node.left);
      }
      if (node.right) {
        queue.push(node.right);
      }
    }
    levels.push(level);
  }
  return levels;
}

const root = new TreeNode(3, new TreeNode(9), new TreeNode(20, new TreeNode(15), new TreeNode(7)));
console.log(levelOrder(root));
`,
      typescript: `class TreeNode {
  constructor(
    public val: number,
    public left: TreeNode | null = null,
    public right: TreeNode | null = null,
  ) {}
}

function levelOrder(root: TreeNode): number[][] {
  const levels: number[][] = [];
  const queue: TreeNode[] = [root];
  while (queue.length > 0) {
    const level: number[] = [];
    const size = queue.length;
    for (let n = 0; n < size; n++) {
      const node = queue.shift()!;
      level.push(node.val);
      if (node.left) {
        queue.push(node.left);
      }
      if (node.right) {
        queue.push(node.right);
      }
    }
    levels.push(level);
  }
  return levels;
}

const root = new TreeNode(3, new TreeNode(9), new TreeNode(20, new TreeNode(15), new TreeNode(7)));
console.log(levelOrder(root));
`,
    },
  },
  {
    id: "invert-tree",
    title: "Invert a binary tree",
    category: "trees",
    summary: "Swap every node's left and right children, all the way down.",
    complexity: "O(n)",
    code: {
      python: `class TreeNode:
    def __init__(self, val, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right


def invert(node):
    if node:
        node.left, node.right = invert(node.right), invert(node.left)
    return node


def preorder(node):
    if not node:
        return []
    return [node.val] + preorder(node.left) + preorder(node.right)


root = TreeNode(
    4,
    TreeNode(2, TreeNode(1), TreeNode(3)),
    TreeNode(7, TreeNode(6), TreeNode(9)),
)
invert(root)
print(preorder(root))
`,
      javascript: `class TreeNode {
  constructor(val, left = null, right = null) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}

function invert(node) {
  if (node) {
    [node.left, node.right] = [invert(node.right), invert(node.left)];
  }
  return node;
}

function preorder(node) {
  if (!node) {
    return [];
  }
  return [node.val, ...preorder(node.left), ...preorder(node.right)];
}

const root = new TreeNode(
  4,
  new TreeNode(2, new TreeNode(1), new TreeNode(3)),
  new TreeNode(7, new TreeNode(6), new TreeNode(9)),
);
invert(root);
console.log(preorder(root));
`,
      typescript: `class TreeNode {
  constructor(
    public val: number,
    public left: TreeNode | null = null,
    public right: TreeNode | null = null,
  ) {}
}

function invert(node: TreeNode | null): TreeNode | null {
  if (node) {
    [node.left, node.right] = [invert(node.right), invert(node.left)];
  }
  return node;
}

function preorder(node: TreeNode | null): number[] {
  if (!node) {
    return [];
  }
  return [node.val, ...preorder(node.left), ...preorder(node.right)];
}

const root = new TreeNode(
  4,
  new TreeNode(2, new TreeNode(1), new TreeNode(3)),
  new TreeNode(7, new TreeNode(6), new TreeNode(9)),
);
invert(root);
console.log(preorder(root));
`,
    },
  },
  {
    id: "bfs",
    title: "Breadth-first search",
    category: "graphs",
    summary: "A queue explores the graph in rings: first the neighbours, then theirs.",
    complexity: "O(V + E)",
    code: {
      python: `from collections import deque

graph = {"A": ["B", "C"], "B": ["D"], "C": ["D", "E"], "D": ["F"], "E": ["F"], "F": []}


def bfs(start):
    seen = {start}
    queue = deque([start])
    order = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for nxt in graph[node]:
            if nxt not in seen:
                seen.add(nxt)
                queue.append(nxt)
    return order


print(bfs("A"))
`,
      javascript: `const graph = {
  A: ["B", "C"],
  B: ["D"],
  C: ["D", "E"],
  D: ["F"],
  E: ["F"],
  F: [],
};

function bfs(start) {
  const seen = new Set([start]);
  const queue = [start];
  const order = [];
  while (queue.length > 0) {
    const node = queue.shift();
    order.push(node);
    for (const next of graph[node]) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return order;
}

console.log(bfs("A"));
`,
      typescript: `type Graph = Record<string, string[]>;

const graph: Graph = {
  A: ["B", "C"],
  B: ["D"],
  C: ["D", "E"],
  D: ["F"],
  E: ["F"],
  F: [],
};

function bfs(start: string): string[] {
  const seen = new Set<string>([start]);
  const queue: string[] = [start];
  const order: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const next of graph[node]) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return order;
}

console.log(bfs("A"));
`,
    },
  },
  {
    id: "dfs",
    title: "Depth-first search",
    category: "graphs",
    summary: "Recursion follows one path as deep as it goes before backing up to try the next.",
    complexity: "O(V + E)",
    code: {
      python: `graph = {
    "A": ["B", "C"],
    "B": ["D", "E"],
    "C": ["F"],
    "D": [],
    "E": ["F"],
    "F": [],
}


def dfs(node, seen, order):
    seen.add(node)
    order.append(node)
    for nxt in graph[node]:
        if nxt not in seen:
            dfs(nxt, seen, order)
    return order


print(dfs("A", set(), []))
`,
      javascript: `const graph = {
  A: ["B", "C"],
  B: ["D", "E"],
  C: ["F"],
  D: [],
  E: ["F"],
  F: [],
};

function dfs(node, seen, order) {
  seen.add(node);
  order.push(node);
  for (const next of graph[node]) {
    if (!seen.has(next)) {
      dfs(next, seen, order);
    }
  }
  return order;
}

console.log(dfs("A", new Set(), []));
`,
      typescript: `type Graph = Record<string, string[]>;

const graph: Graph = {
  A: ["B", "C"],
  B: ["D", "E"],
  C: ["F"],
  D: [],
  E: ["F"],
  F: [],
};

function dfs(node: string, seen: Set<string>, order: string[]): string[] {
  seen.add(node);
  order.push(node);
  for (const next of graph[node]) {
    if (!seen.has(next)) {
      dfs(next, seen, order);
    }
  }
  return order;
}

console.log(dfs("A", new Set<string>(), []));
`,
    },
  },
  {
    id: "topo-sort",
    title: "Topological sort",
    category: "graphs",
    summary: "Kahn's algorithm: repeatedly take a task nothing else is waiting on (getting dressed, in order).",
    complexity: "O(V + E)",
    code: {
      python: `from collections import deque

graph = {
    "shirt": ["tie", "belt"],
    "tie": ["jacket"],
    "pants": ["shoes", "belt"],
    "belt": ["jacket"],
    "socks": ["shoes"],
    "shoes": [],
    "jacket": [],
}


def topo_sort(graph):
    indegree = {node: 0 for node in graph}
    for node in graph:
        for nxt in graph[node]:
            indegree[nxt] += 1
    queue = deque([node for node in graph if indegree[node] == 0])
    order = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for nxt in graph[node]:
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                queue.append(nxt)
    return order


print(topo_sort(graph))
`,
      javascript: `const graph = {
  shirt: ["tie", "belt"],
  tie: ["jacket"],
  pants: ["shoes", "belt"],
  belt: ["jacket"],
  socks: ["shoes"],
  shoes: [],
  jacket: [],
};

function topoSort(graph) {
  const indegree = {};
  for (const node in graph) {
    indegree[node] = 0;
  }
  for (const node in graph) {
    for (const next of graph[node]) {
      indegree[next]++;
    }
  }
  const queue = Object.keys(graph).filter((node) => indegree[node] === 0);
  const order = [];
  while (queue.length > 0) {
    const node = queue.shift();
    order.push(node);
    for (const next of graph[node]) {
      indegree[next]--;
      if (indegree[next] === 0) {
        queue.push(next);
      }
    }
  }
  return order;
}

console.log(topoSort(graph));
`,
      typescript: `type Graph = Record<string, string[]>;

const graph: Graph = {
  shirt: ["tie", "belt"],
  tie: ["jacket"],
  pants: ["shoes", "belt"],
  belt: ["jacket"],
  socks: ["shoes"],
  shoes: [],
  jacket: [],
};

function topoSort(graph: Graph): string[] {
  const indegree: Record<string, number> = {};
  for (const node in graph) {
    indegree[node] = 0;
  }
  for (const node in graph) {
    for (const next of graph[node]) {
      indegree[next]++;
    }
  }
  const queue = Object.keys(graph).filter((node) => indegree[node] === 0);
  const order: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const next of graph[node]) {
      indegree[next]--;
      if (indegree[next] === 0) {
        queue.push(next);
      }
    }
  }
  return order;
}

console.log(topoSort(graph));
`,
    },
  },
  {
    id: "islands",
    title: "Number of islands",
    category: "graphs",
    summary: "Scan the grid; each unvisited 1 starts a flood fill that sinks its whole island.",
    complexity: "O(rows × cols)",
    code: {
      python: `grid = [
    [1, 1, 0, 0],
    [0, 0, 0, 1],
    [1, 0, 1, 1],
]


def sink(r, c):
    if r < 0 or c < 0 or r >= len(grid) or c >= len(grid[0]) or grid[r][c] == 0:
        return
    grid[r][c] = 0
    sink(r + 1, c)
    sink(r - 1, c)
    sink(r, c + 1)
    sink(r, c - 1)


count = 0
for r in range(len(grid)):
    for c in range(len(grid[0])):
        if grid[r][c] == 1:
            count += 1
            sink(r, c)
print(count)
`,
      javascript: `const grid = [
  [1, 1, 0, 0],
  [0, 0, 0, 1],
  [1, 0, 1, 1],
];

function sink(r, c) {
  if (r < 0 || c < 0 || r >= grid.length || c >= grid[0].length || grid[r][c] === 0) {
    return;
  }
  grid[r][c] = 0;
  sink(r + 1, c);
  sink(r - 1, c);
  sink(r, c + 1);
  sink(r, c - 1);
}

let count = 0;
for (let r = 0; r < grid.length; r++) {
  for (let c = 0; c < grid[0].length; c++) {
    if (grid[r][c] === 1) {
      count++;
      sink(r, c);
    }
  }
}
console.log(count);
`,
      typescript: `const grid: number[][] = [
  [1, 1, 0, 0],
  [0, 0, 0, 1],
  [1, 0, 1, 1],
];

function sink(r: number, c: number): void {
  if (r < 0 || c < 0 || r >= grid.length || c >= grid[0].length || grid[r][c] === 0) {
    return;
  }
  grid[r][c] = 0;
  sink(r + 1, c);
  sink(r - 1, c);
  sink(r, c + 1);
  sink(r, c - 1);
}

let count = 0;
for (let r = 0; r < grid.length; r++) {
  for (let c = 0; c < grid[0].length; c++) {
    if (grid[r][c] === 1) {
      count++;
      sink(r, c);
    }
  }
}
console.log(count);
`,
    },
  },
  {
    id: "dijkstra",
    title: "Dijkstra's shortest paths",
    category: "graphs",
    summary: "Always settle the closest unvisited node next, relaxing the edges out of it.",
    complexity: "O(E log V)",
    code: {
      python: `import heapq

graph = {
    "A": [("B", 4), ("C", 1)],
    "B": [("D", 1)],
    "C": [("B", 2), ("D", 5)],
    "D": [],
}


def dijkstra(start):
    dist = {node: float("inf") for node in graph}
    dist[start] = 0
    heap = [(0, start)]
    while heap:
        d, node = heapq.heappop(heap)
        if d > dist[node]:
            continue
        for nxt, weight in graph[node]:
            if d + weight < dist[nxt]:
                dist[nxt] = d + weight
                heapq.heappush(heap, (dist[nxt], nxt))
    return dist


print(dijkstra("A"))
`,
      javascript: `const graph = {
  A: [["B", 4], ["C", 1]],
  B: [["D", 1]],
  C: [["B", 2], ["D", 5]],
  D: [],
};

function dijkstra(start) {
  const dist = {};
  for (const node in graph) {
    dist[node] = Infinity;
  }
  dist[start] = 0;
  const queue = [[0, start]];
  while (queue.length > 0) {
    queue.sort((a, b) => a[0] - b[0]);
    const [d, node] = queue.shift();
    if (d > dist[node]) {
      continue;
    }
    for (const [next, weight] of graph[node]) {
      if (d + weight < dist[next]) {
        dist[next] = d + weight;
        queue.push([dist[next], next]);
      }
    }
  }
  return dist;
}

console.log(dijkstra("A"));
`,
      typescript: `type Edge = [string, number];

const graph: Record<string, Edge[]> = {
  A: [["B", 4], ["C", 1]],
  B: [["D", 1]],
  C: [["B", 2], ["D", 5]],
  D: [],
};

function dijkstra(start: string): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const node in graph) {
    dist[node] = Infinity;
  }
  dist[start] = 0;
  const queue: [number, string][] = [[0, start]];
  while (queue.length > 0) {
    queue.sort((a, b) => a[0] - b[0]);
    const [d, node] = queue.shift()!;
    if (d > dist[node]) {
      continue;
    }
    for (const [next, weight] of graph[node]) {
      if (d + weight < dist[next]) {
        dist[next] = d + weight;
        queue.push([dist[next], next]);
      }
    }
  }
  return dist;
}

console.log(dijkstra("A"));
`,
    },
  },
];