// Big-O Blitz's questions: the time complexity of each snippet, as its
// input (n) grows.

export const BIG_O_CLASSES = ["1", "log n", "n", "n log n", "n²", "2ⁿ"] as const;
export type BigOClass = (typeof BIG_O_CLASSES)[number];

export type BigOItem = {
  id: string;
  language: "javascript" | "python";
  code: string;
  answer: BigOClass;
  explain: string;
};

export const BIG_O_ITEMS: BigOItem[] = [
  {
    id: "first-item",
    language: "javascript",
    code: "function first(items) {\n  return items[0];\n}",
    answer: "1",
    explain: "Reading one element by its index takes the same time however long the array is.",
  },
  {
    id: "map-lookup",
    language: "javascript",
    code: "function priceOf(prices, name) {\n  return prices.get(name);\n}",
    answer: "1",
    explain: "A Map (a hash table) finds a key in constant time on average.",
  },
  {
    id: "sum-loop",
    language: "python",
    code: "def total(nums):\n    result = 0\n    for n in nums:\n        result += n\n    return result",
    answer: "n",
    explain: "One pass over the list: twice the items, twice the work.",
  },
  {
    id: "largest",
    language: "javascript",
    code: "function largest(nums) {\n  let best = -Infinity;\n  for (const n of nums) {\n    if (n > best) best = n;\n  }\n  return best;\n}",
    answer: "n",
    explain: "Every number is looked at once.",
  },
  {
    id: "all-pairs",
    language: "python",
    code: "def count_pairs(nums):\n    count = 0\n    for a in nums:\n        for b in nums:\n            if a + b == 0:\n                count += 1\n    return count",
    answer: "n²",
    explain: "For each of the n items, the inner loop runs n times: n × n.",
  },
  {
    id: "binary-search",
    language: "javascript",
    code: "function search(sorted, target) {\n  let low = 0;\n  let high = sorted.length - 1;\n  while (low <= high) {\n    const mid = Math.floor((low + high) / 2);\n    if (sorted[mid] === target) return mid;\n    if (sorted[mid] < target) low = mid + 1;\n    else high = mid - 1;\n  }\n  return -1;\n}",
    answer: "log n",
    explain: "Each step halves the part of the array that's left to search.",
  },
  {
    id: "halvings",
    language: "python",
    code: "def halvings(n):\n    steps = 0\n    while n > 1:\n        n //= 2\n        steps += 1\n    return steps",
    answer: "log n",
    explain: "n is halved every time around the loop, so it takes about log₂ n steps.",
  },
  {
    id: "merge-sort",
    language: "python",
    code: "def merge_sort(items):\n    if len(items) <= 1:\n        return items\n    mid = len(items) // 2\n    left = merge_sort(items[:mid])\n    right = merge_sort(items[mid:])\n    merged = []\n    i = j = 0\n    while i < len(left) and j < len(right):\n        if left[i] <= right[j]:\n            merged.append(left[i])\n            i += 1\n        else:\n            merged.append(right[j])\n            j += 1\n    return merged + left[i:] + right[j:]",
    answer: "n log n",
    explain: "The list is halved log n times, and each level of halving merges all n items.",
  },
  {
    id: "fibonacci",
    language: "javascript",
    code: "function fib(n) {\n  if (n < 2) return n;\n  return fib(n - 1) + fib(n - 2);\n}",
    answer: "2ⁿ",
    explain: "Every call makes two more calls, so the work roughly doubles each time n grows by one.",
  },
  {
    id: "two-loops",
    language: "javascript",
    code: "function minAndMax(nums) {\n  let min = Infinity;\n  for (const n of nums) min = Math.min(min, n);\n  let max = -Infinity;\n  for (const n of nums) max = Math.max(max, n);\n  return [min, max];\n}",
    answer: "n",
    explain: "Two loops one after the other: n + n is still linear.",
  },
  {
    id: "bubble-sort",
    language: "python",
    code: "def bubble_sort(items):\n    for i in range(len(items)):\n        for j in range(len(items) - i - 1):\n            if items[j] > items[j + 1]:\n                items[j], items[j + 1] = items[j + 1], items[j]\n    return items",
    answer: "n²",
    explain: "Nested loops over the list: about n²/2 comparisons.",
  },
  {
    id: "reverse-array",
    language: "javascript",
    code: "function reverse(items) {\n  const result = [];\n  for (let i = items.length - 1; i >= 0; i--) {\n    result.push(items[i]);\n  }\n  return result;\n}",
    answer: "n",
    explain: "One pass from the end to the start.",
  },
  {
    id: "swap-ends",
    language: "python",
    code: "def swap_ends(items):\n    items[0], items[-1] = items[-1], items[0]\n    return items",
    answer: "1",
    explain: "Two reads and two writes, whatever the length.",
  },
  {
    id: "sort-then-scan",
    language: "javascript",
    code: "function hasDuplicate(nums) {\n  const sorted = [...nums].sort((a, b) => a - b);\n  for (let i = 1; i < sorted.length; i++) {\n    if (sorted[i] === sorted[i - 1]) return true;\n  }\n  return false;\n}",
    answer: "n log n",
    explain: "Sorting takes n log n, and the scan after it is only n, so the sort decides.",
  },
  {
    id: "doubling",
    language: "javascript",
    code: "function countDoublings(n) {\n  let steps = 0;\n  for (let i = 1; i < n; i *= 2) {\n    steps++;\n  }\n  return steps;\n}",
    answer: "log n",
    explain: "i doubles every pass, so it reaches n after about log₂ n passes.",
  },
  {
    id: "unique-pairs",
    language: "python",
    code: "def pairs(items):\n    result = []\n    for i in range(len(items)):\n        for j in range(i + 1, len(items)):\n            result.append((items[i], items[j]))\n    return result",
    answer: "n²",
    explain: "n(n − 1)/2 pairs is still quadratic: halving doesn't change the class.",
  },
  {
    id: "recursive-sum",
    language: "javascript",
    code: "function sum(nums, i = 0) {\n  if (i === nums.length) return 0;\n  return nums[i] + sum(nums, i + 1);\n}",
    answer: "n",
    explain: "One call per item.",
  },
  {
    id: "subsets",
    language: "python",
    code: "def subsets(items):\n    if not items:\n        return [[]]\n    rest = subsets(items[1:])\n    return rest + [[items[0]] + s for s in rest]",
    answer: "2ⁿ",
    explain: "Every item doubles the number of subsets: there are 2ⁿ of them.",
  },
  {
    id: "set-intersection",
    language: "python",
    code: "def common(a, b):\n    seen = set(b)\n    return [x for x in a if x in seen]",
    answer: "n",
    explain: "Building the set is linear, and checking `in` on a set takes constant time.",
  },
  {
    id: "list-intersection",
    language: "python",
    code: "def common(a, b):\n    return [x for x in a if x in b]",
    answer: "n²",
    explain: "`in` on a list scans the whole list, once for every item of a.",
  },
  {
    id: "first-ten",
    language: "javascript",
    code: "function firstTen(items) {\n  const result = [];\n  for (let i = 0; i < 10 && i < items.length; i++) {\n    result.push(items[i]);\n  }\n  return result;\n}",
    answer: "1",
    explain: "At most 10 steps, however long the input is.",
  },
  {
    id: "heap-sort",
    language: "python",
    code: "import heapq\n\ndef smallest_first(nums):\n    heap = []\n    for n in nums:\n        heapq.heappush(heap, n)\n    return [heapq.heappop(heap) for _ in nums]",
    answer: "n log n",
    explain: "n pushes and n pops, each taking log n on a heap.",
  },
  {
    id: "fast-power",
    language: "javascript",
    code: "function power(x, n) {\n  if (n === 0) return 1;\n  const half = power(x, Math.floor(n / 2));\n  return n % 2 === 0 ? half * half : half * half * x;\n}",
    answer: "log n",
    explain: "Each call halves n (exponentiation by squaring).",
  },
  {
    id: "most-common",
    language: "python",
    code: "def most_common(words):\n    counts = {}\n    for word in words:\n        counts[word] = counts.get(word, 0) + 1\n    return max(counts, key=counts.get)",
    answer: "n",
    explain: "One pass to count (dictionary updates are constant time), one pass to find the max.",
  },
  {
    id: "list-length",
    language: "javascript",
    code: "function length(head) {\n  let count = 0;\n  for (let node = head; node; node = node.next) count++;\n  return count;\n}",
    answer: "n",
    explain: "A linked list has to be walked node by node.",
  },
  {
    id: "pairwise-duplicates",
    language: "javascript",
    code: "function hasDuplicate(items) {\n  for (let i = 0; i < items.length; i++) {\n    for (let j = i + 1; j < items.length; j++) {\n      if (items[i] === items[j]) return true;\n    }\n  }\n  return false;\n}",
    answer: "n²",
    explain: "Comparing every item with every later one: quadratic.",
  },
  {
    id: "count-digits",
    language: "python",
    code: "def digits(n):\n    count = 1\n    while n >= 10:\n        n //= 10\n        count += 1\n    return count",
    answer: "log n",
    explain: "Dividing by 10 each time: about log₁₀ n steps (the number of digits).",
  },
  {
    id: "two-pointers",
    language: "javascript",
    code: "function isPalindrome(text) {\n  let left = 0;\n  let right = text.length - 1;\n  while (left < right) {\n    if (text[left] !== text[right]) return false;\n    left++;\n    right--;\n  }\n  return true;\n}",
    answer: "n",
    explain: "The two ends move toward each other: n/2 steps.",
  },
  {
    id: "binary-search-each",
    language: "python",
    code: "from bisect import bisect_left\n\ndef count_found(sorted_items, queries):\n    found = 0\n    for q in queries:\n        i = bisect_left(sorted_items, q)\n        if i < len(sorted_items) and sorted_items[i] == q:\n            found += 1\n    return found",
    answer: "n log n",
    explain: "A binary search (log n) for each of n queries.",
  },
  {
    id: "gauss",
    language: "javascript",
    code: "function sumTo(n) {\n  return (n * (n + 1)) / 2;\n}",
    answer: "1",
    explain: "A formula instead of a loop: one calculation for any n.",
  },
  {
    id: "grid",
    language: "python",
    code: "def print_grid(n):\n    for row in range(n):\n        print(\" \".join(\"#\" for _ in range(n)))",
    answer: "n²",
    explain: "n rows of n characters each.",
  },
  {
    id: "hanoi",
    language: "javascript",
    code: "function hanoi(n, from, to, via) {\n  if (n === 0) return 0;\n  return hanoi(n - 1, from, via, to) + 1 + hanoi(n - 1, via, to, from);\n}",
    answer: "2ⁿ",
    explain: "Two recursive calls on n − 1: the moves double with every disk (2ⁿ − 1).",
  },
];
