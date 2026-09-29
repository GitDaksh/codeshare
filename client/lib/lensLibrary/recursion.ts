import type { LensConcept } from "./index";

// Recursion & backtracking, and dynamic programming.

export const RECURSION_CONCEPTS: LensConcept[] = [
  {
    id: "recursion",
    title: "Recursion (factorial)",
    category: "recursion",
    summary: "Each call waits on a smaller one; watch the call stack grow, then unwind.",
    complexity: "O(n)",
    code: {
      python: `def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)


print(factorial(5))
`,
      javascript: `function factorial(n) {
  if (n <= 1) {
    return 1;
  }
  return n * factorial(n - 1);
}

const result = factorial(5);
console.log(result);
`,
      typescript: `function factorial(n: number): number {
  if (n <= 1) {
    return 1;
  }
  return n * factorial(n - 1);
}

const result: number = factorial(5);
console.log(result);
`,
    },
  },
  {
    id: "permutations",
    title: "Permutations (backtracking)",
    category: "recursion",
    summary: "Choose an unused number, recurse, then undo the choice and try the next one.",
    complexity: "O(n · n!)",
    code: {
      python: `def permutations(nums):
    result = []
    path = []
    used = [False] * len(nums)

    def backtrack():
        if len(path) == len(nums):
            result.append(path[:])
            return
        for i in range(len(nums)):
            if not used[i]:
                used[i] = True
                path.append(nums[i])
                backtrack()
                path.pop()
                used[i] = False

    backtrack()
    return result


print(permutations([1, 2, 3]))
`,
      javascript: `function permutations(nums) {
  const result = [];
  const path = [];
  const used = new Array(nums.length).fill(false);

  function backtrack() {
    if (path.length === nums.length) {
      result.push([...path]);
      return;
    }
    for (let i = 0; i < nums.length; i++) {
      if (!used[i]) {
        used[i] = true;
        path.push(nums[i]);
        backtrack();
        path.pop();
        used[i] = false;
      }
    }
  }

  backtrack();
  return result;
}

console.log(permutations([1, 2, 3]));
`,
      typescript: `function permutations(nums: number[]): number[][] {
  const result: number[][] = [];
  const path: number[] = [];
  const used: boolean[] = new Array(nums.length).fill(false);

  function backtrack(): void {
    if (path.length === nums.length) {
      result.push([...path]);
      return;
    }
    for (let i = 0; i < nums.length; i++) {
      if (!used[i]) {
        used[i] = true;
        path.push(nums[i]);
        backtrack();
        path.pop();
        used[i] = false;
      }
    }
  }

  backtrack();
  return result;
}

console.log(permutations([1, 2, 3]));
`,
    },
  },
  {
    id: "n-queens",
    title: "N-Queens",
    category: "recursion",
    summary: "Place one queen per row, skipping attacked columns and diagonals, and backtrack when stuck.",
    complexity: "O(n!)",
    code: {
      python: `def solve_queens(n):
    board = [["."] * n for _ in range(n)]
    cols, diag1, diag2 = set(), set(), set()
    solutions = []

    def place(row):
        if row == n:
            solutions.append(["".join(line) for line in board])
            return
        for col in range(n):
            if col in cols or row - col in diag1 or row + col in diag2:
                continue
            board[row][col] = "Q"
            cols.add(col)
            diag1.add(row - col)
            diag2.add(row + col)
            place(row + 1)
            board[row][col] = "."
            cols.remove(col)
            diag1.remove(row - col)
            diag2.remove(row + col)

    place(0)
    return solutions


print(solve_queens(4))
`,
      javascript: `function solveQueens(n) {
  const board = Array.from({ length: n }, () => new Array(n).fill("."));
  const cols = new Set();
  const diag1 = new Set();
  const diag2 = new Set();
  const solutions = [];

  function place(row) {
    if (row === n) {
      solutions.push(board.map((line) => line.join("")));
      return;
    }
    for (let col = 0; col < n; col++) {
      if (cols.has(col) || diag1.has(row - col) || diag2.has(row + col)) {
        continue;
      }
      board[row][col] = "Q";
      cols.add(col);
      diag1.add(row - col);
      diag2.add(row + col);
      place(row + 1);
      board[row][col] = ".";
      cols.delete(col);
      diag1.delete(row - col);
      diag2.delete(row + col);
    }
  }

  place(0);
  return solutions;
}

console.log(solveQueens(4));
`,
      typescript: `function solveQueens(n: number): string[][] {
  const board: string[][] = Array.from({ length: n }, () => new Array(n).fill("."));
  const cols = new Set<number>();
  const diag1 = new Set<number>();
  const diag2 = new Set<number>();
  const solutions: string[][] = [];

  function place(row: number): void {
    if (row === n) {
      solutions.push(board.map((line) => line.join("")));
      return;
    }
    for (let col = 0; col < n; col++) {
      if (cols.has(col) || diag1.has(row - col) || diag2.has(row + col)) {
        continue;
      }
      board[row][col] = "Q";
      cols.add(col);
      diag1.add(row - col);
      diag2.add(row + col);
      place(row + 1);
      board[row][col] = ".";
      cols.delete(col);
      diag1.delete(row - col);
      diag2.delete(row + col);
    }
  }

  place(0);
  return solutions;
}

console.log(solveQueens(4));
`,
    },
  },
  {
    id: "climbing-stairs",
    title: "Climbing stairs",
    category: "dp",
    summary: "The ways to reach each step are the ways to reach the two steps below it, filled in order.",
    complexity: "O(n)",
    code: {
      python: `def climb_stairs(n):
    ways = [0] * (n + 1)
    ways[0] = 1
    ways[1] = 1
    for i in range(2, n + 1):
        ways[i] = ways[i - 1] + ways[i - 2]
    return ways[n]


print(climb_stairs(7))
`,
      javascript: `function climbStairs(n) {
  const ways = new Array(n + 1).fill(0);
  ways[0] = 1;
  ways[1] = 1;
  for (let i = 2; i <= n; i++) {
    ways[i] = ways[i - 1] + ways[i - 2];
  }
  return ways[n];
}

console.log(climbStairs(7));
`,
      typescript: `function climbStairs(n: number): number {
  const ways: number[] = new Array(n + 1).fill(0);
  ways[0] = 1;
  ways[1] = 1;
  for (let i = 2; i <= n; i++) {
    ways[i] = ways[i - 1] + ways[i - 2];
  }
  return ways[n];
}

console.log(climbStairs(7));
`,
    },
  },
  {
    id: "coin-change",
    title: "Coin change",
    category: "dp",
    summary: "The fewest coins for every total, built from the answers for smaller totals.",
    complexity: "O(amount × coins)",
    code: {
      python: `def coin_change(coins, amount):
    best = [0] + [amount + 1] * amount
    for total in range(1, amount + 1):
        for coin in coins:
            if coin <= total:
                best[total] = min(best[total], best[total - coin] + 1)
    return best[amount] if best[amount] <= amount else -1


print(coin_change([1, 3, 4], 6))
`,
      javascript: `function coinChange(coins, amount) {
  const best = new Array(amount + 1).fill(amount + 1);
  best[0] = 0;
  for (let total = 1; total <= amount; total++) {
    for (const coin of coins) {
      if (coin <= total) {
        best[total] = Math.min(best[total], best[total - coin] + 1);
      }
    }
  }
  return best[amount] <= amount ? best[amount] : -1;
}

console.log(coinChange([1, 3, 4], 6));
`,
      typescript: `function coinChange(coins: number[], amount: number): number {
  const best: number[] = new Array(amount + 1).fill(amount + 1);
  best[0] = 0;
  for (let total = 1; total <= amount; total++) {
    for (const coin of coins) {
      if (coin <= total) {
        best[total] = Math.min(best[total], best[total - coin] + 1);
      }
    }
  }
  return best[amount] <= amount ? best[amount] : -1;
}

console.log(coinChange([1, 3, 4], 6));
`,
    },
  },
  {
    id: "lcs",
    title: "Longest common subsequence",
    category: "dp",
    summary: "Fill a table where each cell compares one letter from each word.",
    complexity: "O(n × m)",
    code: {
      python: `def lcs(a, b):
    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[len(a)][len(b)]


print(lcs("ABCB", "BDCAB"))
`,
      javascript: `function lcs(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp[a.length][b.length];
}

console.log(lcs("ABCB", "BDCAB"));
`,
      typescript: `function lcs(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp[a.length][b.length];
}

console.log(lcs("ABCB", "BDCAB"));
`,
    },
  },
  {
    id: "knapsack",
    title: "0/1 knapsack",
    category: "dp",
    summary: "For each item and each capacity, take the better of skipping the item or packing it.",
    complexity: "O(n × capacity)",
    code: {
      python: `def knapsack(weights, values, capacity):
    n = len(weights)
    dp = [[0] * (capacity + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        for c in range(capacity + 1):
            dp[i][c] = dp[i - 1][c]
            if weights[i - 1] <= c:
                dp[i][c] = max(dp[i][c], dp[i - 1][c - weights[i - 1]] + values[i - 1])
    return dp[n][capacity]


print(knapsack([1, 3, 4], [15, 20, 30], 4))
`,
      javascript: `function knapsack(weights, values, capacity) {
  const n = weights.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let c = 0; c <= capacity; c++) {
      dp[i][c] = dp[i - 1][c];
      if (weights[i - 1] <= c) {
        dp[i][c] = Math.max(dp[i][c], dp[i - 1][c - weights[i - 1]] + values[i - 1]);
      }
    }
  }
  return dp[n][capacity];
}

console.log(knapsack([1, 3, 4], [15, 20, 30], 4));
`,
      typescript: `function knapsack(weights: number[], values: number[], capacity: number): number {
  const n = weights.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let c = 0; c <= capacity; c++) {
      dp[i][c] = dp[i - 1][c];
      if (weights[i - 1] <= c) {
        dp[i][c] = Math.max(dp[i][c], dp[i - 1][c - weights[i - 1]] + values[i - 1]);
      }
    }
  }
  return dp[n][capacity];
}

console.log(knapsack([1, 3, 4], [15, 20, 30], 4));
`,
    },
  },
];