import { formatValue, type CompareMode } from "@/lib/judge";

export type Difficulty = "Easy" | "Medium" | "Hard";

// A tiny type language used to generate starter code for every language and
// to tell the test runner how to build inputs and read results.
export type ValueType =
  | "int"
  | "int[]"
  | "int[][]"
  | "float"
  | "str"
  | "str[]"
  | "str[][]"
  | "bool"
  // A singly linked list, written as an array of its values: [1, 2, 3].
  | "list"
  // Several linked lists: [[1, 4], [2]].
  | "list[]"
  // A binary tree in level order, with null for a missing child: [1, null, 2].
  | "tree";

export type ProblemTest = {
  args: unknown[];
  expected: unknown;
  // Examples are shown in the problem statement as well as run as tests.
  example?: boolean;
  explanation?: string;
};

export type Problem = {
  slug: string;
  title: string;
  difficulty: Difficulty;
  topics: string[];
  summary: string;
  description: string[];
  constraints: string[];
  hint: string;
  functionName: { js: string; py: string };
  params: { name: string; type: ValueType }[];
  // "void" means the function changes an argument in place; outputArg says
  // which one the tests check afterwards.
  returns: ValueType | "void";
  outputArg?: number;
  compare?: CompareMode;
  tests: ProblemTest[];
};

// Tests run in the browser, so only languages we can execute there are testable.
export const TESTABLE_LANGUAGES = ["javascript", "typescript", "python"] as const;

export function isTestableLanguage(language: string): boolean {
  return (TESTABLE_LANGUAGES as readonly string[]).includes(language);
}

export const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard"];

export const PROBLEMS: Problem[] = [
  {
    slug: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    topics: ["Arrays", "Hash map"],
    summary: "Find the two numbers that add up to a target.",
    description: [
      "Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`.",
      "Every input has exactly one valid answer, and you may not use the same element twice. Return the two indices in increasing order.",
    ],
    constraints: [
      "`2 <= nums.length <= 10^4`",
      "`-10^9 <= nums[i], target <= 10^9`",
      "Exactly one valid answer exists.",
    ],
    hint: "For each number, the partner you need is `target - number`. A hash map from value to index lets you check for it in constant time.",
    functionName: { js: "twoSum", py: "two_sum" },
    params: [
      { name: "nums", type: "int[]" },
      { name: "target", type: "int" },
    ],
    returns: "int[]",
    tests: [
      { args: [[2, 7, 11, 15], 9], expected: [0, 1], example: true, explanation: "nums[0] + nums[1] = 2 + 7 = 9." },
      { args: [[3, 2, 4], 6], expected: [1, 2], example: true },
      { args: [[3, 3], 6], expected: [0, 1], example: true },
      { args: [[-1, -2, -3, -4, -5], -8], expected: [2, 4] },
      { args: [[0, 4, 3, 0], 0], expected: [0, 3] },
      { args: [[1, 5, 9, 14, 20], 34], expected: [3, 4] },
      { args: [[5, 75, 25], 100], expected: [1, 2] },
    ],
  },
  {
    slug: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "Easy",
    topics: ["Strings", "Stack"],
    summary: "Check whether every bracket is closed in the right order.",
    description: [
      "Given a string `s` made up only of the characters `(`, `)`, `{`, `}`, `[` and `]`, decide whether it is valid.",
      "A string is valid when every opening bracket is closed by the same type of bracket, brackets close in the correct order, and every closing bracket has a matching opening bracket.",
    ],
    constraints: ["`1 <= s.length <= 10^4`", "`s` contains only the six bracket characters."],
    hint: "Push each opening bracket onto a stack. When you see a closing bracket, the top of the stack must be its matching opener.",
    functionName: { js: "isValid", py: "is_valid" },
    params: [{ name: "s", type: "str" }],
    returns: "bool",
    tests: [
      { args: ["()"], expected: true, example: true },
      { args: ["()[]{}"], expected: true, example: true },
      { args: ["(]"], expected: false, example: true },
      { args: ["([)]"], expected: false },
      { args: ["{[]}"], expected: true },
      { args: ["(("], expected: false },
      { args: ["){"], expected: false },
      { args: ["[({})]"], expected: true },
    ],
  },
  {
    slug: "valid-anagram",
    title: "Valid Anagram",
    difficulty: "Easy",
    topics: ["Strings", "Hash map"],
    summary: "Decide whether two words use exactly the same letters.",
    description: [
      "Given two strings `s` and `t`, return `true` if `t` is an anagram of `s`, and `false` otherwise.",
      "An anagram uses exactly the same letters as the original, the same number of times, possibly in a different order.",
    ],
    constraints: ["`1 <= s.length, t.length <= 5 * 10^4`", "`s` and `t` contain only lowercase English letters."],
    hint: "Count how many times each letter appears in `s`, then subtract the counts for `t`. Every count should end at zero.",
    functionName: { js: "isAnagram", py: "is_anagram" },
    params: [
      { name: "s", type: "str" },
      { name: "t", type: "str" },
    ],
    returns: "bool",
    tests: [
      { args: ["anagram", "nagaram"], expected: true, example: true },
      { args: ["rat", "car"], expected: false, example: true },
      { args: ["a", "a"], expected: true },
      { args: ["ab", "a"], expected: false },
      { args: ["listen", "silent"], expected: true },
      { args: ["aacc", "ccac"], expected: false },
    ],
  },
  {
    slug: "binary-search",
    title: "Binary Search",
    difficulty: "Easy",
    topics: ["Arrays", "Binary search"],
    summary: "Find a target in a sorted array in logarithmic time.",
    description: [
      "Given an array of integers `nums` sorted in ascending order and an integer `target`, return the index of `target` in `nums`, or `-1` if it isn't there.",
      "All values in `nums` are distinct. Aim for an `O(log n)` solution.",
    ],
    constraints: ["`1 <= nums.length <= 10^4`", "`-10^4 < nums[i], target < 10^4`", "`nums` is sorted in ascending order with no duplicates."],
    hint: "Compare `target` with the middle element. Each comparison lets you throw away half of the remaining range.",
    functionName: { js: "search", py: "search" },
    params: [
      { name: "nums", type: "int[]" },
      { name: "target", type: "int" },
    ],
    returns: "int",
    tests: [
      { args: [[-1, 0, 3, 5, 9, 12], 9], expected: 4, example: true, explanation: "9 is at index 4." },
      { args: [[-1, 0, 3, 5, 9, 12], 2], expected: -1, example: true, explanation: "2 isn't in the array." },
      { args: [[5], 5], expected: 0 },
      { args: [[5], -5], expected: -1 },
      { args: [[1, 3, 5, 7, 9, 11], 1], expected: 0 },
      { args: [[1, 3, 5, 7, 9, 11], 11], expected: 5 },
      { args: [[2, 4, 6, 8], 5], expected: -1 },
    ],
  },
  {
    slug: "best-time-to-buy-and-sell-stock",
    title: "Best Time to Buy and Sell Stock",
    difficulty: "Easy",
    topics: ["Arrays", "Greedy"],
    summary: "Pick one day to buy and a later day to sell for the biggest profit.",
    description: [
      "You're given an array `prices` where `prices[i]` is a stock's price on day `i`. Choose one day to buy and a **later** day to sell.",
      "Return the largest profit you can make. If no trade makes money, return `0`.",
    ],
    constraints: ["`1 <= prices.length <= 10^5`", "`0 <= prices[i] <= 10^4`"],
    hint: "Scan the days once, remembering the cheapest price so far. Each day, the best sale is today's price minus that minimum.",
    functionName: { js: "maxProfit", py: "max_profit" },
    params: [{ name: "prices", type: "int[]" }],
    returns: "int",
    tests: [
      { args: [[7, 1, 5, 3, 6, 4]], expected: 5, example: true, explanation: "Buy at 1 (day 1) and sell at 6 (day 4)." },
      { args: [[7, 6, 4, 3, 1]], expected: 0, example: true, explanation: "Prices only fall, so the best move is not to trade." },
      { args: [[1]], expected: 0 },
      { args: [[2, 4, 1]], expected: 2 },
      { args: [[3, 3, 5, 0, 0, 3, 1, 4]], expected: 4 },
      { args: [[1, 2, 3, 4, 5]], expected: 4 },
      { args: [[2, 1, 2, 1, 0, 1, 2]], expected: 2 },
    ],
  },
  {
    slug: "valid-palindrome",
    title: "Valid Palindrome",
    difficulty: "Easy",
    topics: ["Strings", "Two pointers"],
    summary: "Check whether a phrase reads the same both ways, ignoring punctuation.",
    description: [
      "A phrase is a palindrome if, after converting uppercase letters to lowercase and removing everything that isn't a letter or a digit, it reads the same forwards and backwards.",
      "Given a string `s`, return `true` if it is a palindrome and `false` otherwise.",
    ],
    constraints: ["`1 <= s.length <= 2 * 10^5`", "`s` contains printable ASCII characters."],
    hint: "Use two pointers from both ends. Skip anything that isn't a letter or digit, and compare the rest case-insensitively.",
    functionName: { js: "isPalindrome", py: "is_palindrome" },
    params: [{ name: "s", type: "str" }],
    returns: "bool",
    tests: [
      {
        args: ["A man, a plan, a canal: Panama"],
        expected: true,
        example: true,
        explanation: "After cleanup it reads \"amanaplanacanalpanama\" both ways.",
      },
      { args: ["race a car"], expected: false, example: true },
      {
        args: [" "],
        expected: true,
        example: true,
        explanation: "After cleanup the string is empty, which counts as a palindrome.",
      },
      { args: ["0P"], expected: false },
      { args: ["No 'x' in Nixon"], expected: true },
      { args: ["ab_a"], expected: true },
      { args: ["Madam, I'm Adam"], expected: true },
    ],
  },
  {
    slug: "climbing-stairs",
    title: "Climbing Stairs",
    difficulty: "Easy",
    topics: ["Dynamic programming", "Math"],
    summary: "Count the ways to climb a staircase one or two steps at a time.",
    description: [
      "You're climbing a staircase with `n` steps. With each move you can climb either 1 or 2 steps.",
      "Return the number of distinct ways to reach the top.",
    ],
    constraints: ["`1 <= n <= 45`"],
    hint: "To reach step `n`, your last move came from step `n - 1` or step `n - 2`. So the ways to reach `n` are the sum of the ways to reach those two.",
    functionName: { js: "climbStairs", py: "climb_stairs" },
    params: [{ name: "n", type: "int" }],
    returns: "int",
    tests: [
      { args: [2], expected: 2, example: true, explanation: "1 step + 1 step, or 2 steps at once." },
      { args: [3], expected: 3, example: true, explanation: "1 + 1 + 1, 1 + 2, or 2 + 1." },
      { args: [1], expected: 1 },
      { args: [5], expected: 8 },
      { args: [10], expected: 89 },
      { args: [45], expected: 1836311903 },
    ],
  },
  {
    slug: "missing-number",
    title: "Missing Number",
    difficulty: "Easy",
    topics: ["Arrays", "Math"],
    summary: "Find the one number missing from a range.",
    description: [
      "The array `nums` contains `n` distinct numbers taken from the range `0` to `n`, so exactly one number in that range is missing.",
      "Return the missing number.",
    ],
    constraints: ["`1 <= nums.length <= 10^4`", "`0 <= nums[i] <= n`", "All numbers in `nums` are distinct."],
    hint: "The numbers from `0` to `n` add up to `n * (n + 1) / 2`. Subtract the actual sum of `nums` from that.",
    functionName: { js: "missingNumber", py: "missing_number" },
    params: [{ name: "nums", type: "int[]" }],
    returns: "int",
    tests: [
      { args: [[3, 0, 1]], expected: 2, example: true, explanation: "n = 3, so the range is 0 to 3, and 2 is missing." },
      { args: [[0, 1]], expected: 2, example: true },
      { args: [[9, 6, 4, 2, 3, 5, 7, 0, 1]], expected: 8, example: true },
      { args: [[0]], expected: 1 },
      { args: [[1]], expected: 0 },
      { args: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], expected: 0 },
    ],
  },
  {
    slug: "first-unique-character",
    title: "First Unique Character",
    difficulty: "Easy",
    topics: ["Strings", "Hash map"],
    summary: "Find the first character that appears only once.",
    description: [
      "Given a string `s`, return the index of the first character that appears exactly once in it.",
      "If every character repeats, return `-1`.",
    ],
    constraints: ["`1 <= s.length <= 10^5`", "`s` contains only lowercase English letters."],
    hint: "Make one pass to count every character, then a second pass to find the first one with a count of 1.",
    functionName: { js: "firstUniqChar", py: "first_uniq_char" },
    params: [{ name: "s", type: "str" }],
    returns: "int",
    tests: [
      { args: ["swiss"], expected: 1, example: true, explanation: "'w' is the first character that appears only once." },
      { args: ["aabb"], expected: -1, example: true },
      { args: ["codeshare"], expected: 0, example: true },
      { args: ["z"], expected: 0 },
      { args: ["abcabcd"], expected: 6 },
      { args: ["xxyzz"], expected: 2 },
    ],
  },
  {
    slug: "roman-to-integer",
    title: "Roman to Integer",
    difficulty: "Easy",
    topics: ["Strings", "Math", "Hash map"],
    summary: "Convert a Roman numeral into a number.",
    description: [
      "Roman numerals use seven symbols: `I` = 1, `V` = 5, `X` = 10, `L` = 50, `C` = 100, `D` = 500 and `M` = 1000.",
      "Symbols are usually written from largest to smallest and added together. When a smaller symbol comes right before a larger one, it is subtracted instead: `IV` = 4, `IX` = 9, `XL` = 40, `XC` = 90, `CD` = 400 and `CM` = 900.",
      "Given a valid Roman numeral `s`, return its value.",
    ],
    constraints: ["`1 <= s.length <= 15`", "`s` is a valid Roman numeral between 1 and 3999."],
    hint: "Read left to right. If a symbol is smaller than the one after it, subtract it; otherwise add it.",
    functionName: { js: "romanToInt", py: "roman_to_int" },
    params: [{ name: "s", type: "str" }],
    returns: "int",
    tests: [
      { args: ["III"], expected: 3, example: true },
      { args: ["LVIII"], expected: 58, example: true, explanation: "L = 50, V = 5, III = 3." },
      { args: ["MCMXCIV"], expected: 1994, example: true, explanation: "M = 1000, CM = 900, XC = 90, IV = 4." },
      { args: ["IX"], expected: 9 },
      { args: ["XL"], expected: 40 },
      { args: ["MMMCMXCIX"], expected: 3999 },
      { args: ["CDXLIV"], expected: 444 },
    ],
  },
  {
    slug: "single-number",
    title: "Single Number",
    difficulty: "Easy",
    topics: ["Bit manipulation", "Arrays"],
    summary: "Every number appears twice except one. Find it.",
    description: [
      "Every element of the integer array `nums` appears exactly twice, except for one element that appears once. Return that single element.",
      "Aim for linear time and constant extra space.",
    ],
    constraints: ["`1 <= nums.length <= 3 * 10^4`", "`-3 * 10^4 <= nums[i] <= 3 * 10^4`"],
    hint: "XOR has two handy properties: `x ^ x = 0` and `x ^ 0 = x`. XOR everything together and the pairs cancel out.",
    functionName: { js: "singleNumber", py: "single_number" },
    params: [{ name: "nums", type: "int[]" }],
    returns: "int",
    tests: [
      { args: [[2, 2, 1]], expected: 1, example: true },
      { args: [[4, 1, 2, 1, 2]], expected: 4, example: true },
      { args: [[1]], expected: 1, example: true },
      { args: [[-1, -1, -2]], expected: -2 },
      { args: [[0, 7, 7]], expected: 0 },
      { args: [[9, 3, 5, 3, 9]], expected: 5 },
    ],
  },
  {
    slug: "counting-bits",
    title: "Counting Bits",
    difficulty: "Easy",
    topics: ["Bit manipulation", "Dynamic programming"],
    summary: "Count the 1s in the binary form of every number up to n.",
    description: [
      "Given an integer `n`, return an array `ans` of length `n + 1` where `ans[i]` is the number of `1` bits in the binary representation of `i`.",
    ],
    constraints: ["`0 <= n <= 10^5`"],
    hint: "`i` has the same bits as `i >> 1` (that is, `i` divided by 2), plus one more if `i` is odd. So `ans[i] = ans[i >> 1] + (i & 1)`.",
    functionName: { js: "countBits", py: "count_bits" },
    params: [{ name: "n", type: "int" }],
    returns: "int[]",
    tests: [
      { args: [2], expected: [0, 1, 1], example: true, explanation: "0 is 0, 1 is 1 and 2 is 10 in binary." },
      { args: [5], expected: [0, 1, 1, 2, 1, 2], example: true },
      { args: [0], expected: [0] },
      { args: [1], expected: [0, 1] },
      { args: [8], expected: [0, 1, 1, 2, 1, 2, 2, 3, 1] },
      { args: [15], expected: [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4] },
    ],
  },
  {
    slug: "move-zeroes",
    title: "Move Zeroes",
    difficulty: "Easy",
    topics: ["Arrays", "Two pointers"],
    summary: "Shift every zero to the end while keeping the other numbers in order.",
    description: [
      "Given an integer array `nums`, move all the `0`s to the end while keeping the relative order of the non-zero numbers.",
      "Do this **in place**: change `nums` directly instead of returning a new array. The tests check `nums` after your function finishes.",
    ],
    constraints: ["`1 <= nums.length <= 10^4`", "`-2^31 <= nums[i] <= 2^31 - 1`"],
    hint: "Keep a write position. Copy each non-zero number to the write position as you scan, then fill the remaining slots with zeros.",
    functionName: { js: "moveZeroes", py: "move_zeroes" },
    params: [{ name: "nums", type: "int[]" }],
    returns: "void",
    outputArg: 0,
    tests: [
      {
        args: [[0, 1, 0, 3, 12]],
        expected: [1, 3, 12, 0, 0],
        example: true,
        explanation: "The non-zero numbers keep their order: 1, 3, 12.",
      },
      { args: [[0]], expected: [0], example: true },
      { args: [[1, 2, 3]], expected: [1, 2, 3] },
      { args: [[0, 0, 1]], expected: [1, 0, 0] },
      { args: [[4, 0, 5, 0, 0, 6]], expected: [4, 5, 6, 0, 0, 0] },
      { args: [[-1, 0, -2, 0]], expected: [-1, -2, 0, 0] },
    ],
  },
  {
    slug: "reverse-linked-list",
    title: "Reverse Linked List",
    difficulty: "Easy",
    topics: ["Linked list"],
    summary: "Reverse the direction of a singly linked list.",
    description: [
      "Given the `head` of a singly linked list, reverse the list and return the new head.",
      "Lists are written as arrays in the examples: `[1, 2, 3]` means `1 → 2 → 3`, and `[]` is an empty list (a `null` head).",
    ],
    constraints: ["The list has between `0` and `5000` nodes.", "`-5000 <= Node.val <= 5000`"],
    hint: "Walk the list once, pointing each node's `next` back at the previous node. Keep track of `prev`, `current` and the next node before you overwrite the link.",
    functionName: { js: "reverseList", py: "reverse_list" },
    params: [{ name: "head", type: "list" }],
    returns: "list",
    tests: [
      { args: [[1, 2, 3, 4, 5]], expected: [5, 4, 3, 2, 1], example: true },
      { args: [[1, 2]], expected: [2, 1], example: true },
      { args: [[]], expected: [], example: true },
      { args: [[7]], expected: [7] },
      { args: [[1, 1, 2, 2]], expected: [2, 2, 1, 1] },
      { args: [[-3, 0, 3]], expected: [3, 0, -3] },
    ],
  },
  {
    slug: "merge-two-sorted-lists",
    title: "Merge Two Sorted Lists",
    difficulty: "Easy",
    topics: ["Linked list", "Two pointers"],
    summary: "Splice two sorted linked lists into one sorted list.",
    description: [
      "You're given the heads of two sorted linked lists, `list1` and `list2`. Merge them into one sorted list by splicing their nodes together, and return its head.",
      "Lists are written as arrays: `[1, 2, 4]` means `1 → 2 → 4`.",
    ],
    constraints: [
      "Each list has between `0` and `50` nodes.",
      "`-100 <= Node.val <= 100`",
      "Both lists are sorted in non-decreasing order.",
    ],
    hint: "Start from a dummy node and keep attaching the smaller of the two current heads. When one list runs out, attach the rest of the other.",
    functionName: { js: "mergeTwoLists", py: "merge_two_lists" },
    params: [
      { name: "list1", type: "list" },
      { name: "list2", type: "list" },
    ],
    returns: "list",
    tests: [
      { args: [[1, 2, 4], [1, 3, 4]], expected: [1, 1, 2, 3, 4, 4], example: true },
      { args: [[], []], expected: [], example: true },
      { args: [[], [0]], expected: [0], example: true },
      { args: [[5], [1, 2, 3]], expected: [1, 2, 3, 5] },
      { args: [[1, 3, 5, 7], [2, 4, 6, 8]], expected: [1, 2, 3, 4, 5, 6, 7, 8] },
      { args: [[-2, -1], [-3]], expected: [-3, -2, -1] },
    ],
  },
  {
    slug: "maximum-depth-of-binary-tree",
    title: "Maximum Depth of Binary Tree",
    difficulty: "Easy",
    topics: ["Trees"],
    summary: "Measure how many levels deep a binary tree goes.",
    description: [
      "Given the `root` of a binary tree, return its maximum depth: the number of nodes along the longest path from the root down to a leaf.",
      "Trees are written level by level, with `null` for a missing child. `[3, 9, 20, null, null, 15, 7]` is a root `3` with children `9` and `20`, where `20` has children `15` and `7`.",
    ],
    constraints: ["The tree has between `0` and `10^4` nodes.", "`-100 <= Node.val <= 100`"],
    hint: "The depth of a tree is 1 plus the larger depth of its two subtrees. An empty tree has depth 0.",
    functionName: { js: "maxDepth", py: "max_depth" },
    params: [{ name: "root", type: "tree" }],
    returns: "int",
    tests: [
      { args: [[3, 9, 20, null, null, 15, 7]], expected: 3, example: true },
      { args: [[1, null, 2]], expected: 2, example: true },
      { args: [[]], expected: 0, example: true },
      { args: [[0]], expected: 1 },
      { args: [[1, 2, 3, 4, null, null, 5, 6]], expected: 4 },
      { args: [[1, 2, null, 3, null, 4, null, 5]], expected: 5 },
    ],
  },
  {
    slug: "invert-binary-tree",
    title: "Invert Binary Tree",
    difficulty: "Easy",
    topics: ["Trees"],
    summary: "Mirror a binary tree from left to right.",
    description: [
      "Given the `root` of a binary tree, swap the left and right children of every node, and return the root.",
      "Trees are written level by level, with `null` for a missing child.",
    ],
    constraints: ["The tree has between `0` and `100` nodes.", "`-100 <= Node.val <= 100`"],
    hint: "Swap the root's two children, then invert each subtree the same way. Recursion or a queue both work.",
    functionName: { js: "invertTree", py: "invert_tree" },
    params: [{ name: "root", type: "tree" }],
    returns: "tree",
    tests: [
      { args: [[4, 2, 7, 1, 3, 6, 9]], expected: [4, 7, 2, 9, 6, 3, 1], example: true },
      { args: [[2, 1, 3]], expected: [2, 3, 1], example: true },
      { args: [[]], expected: [], example: true },
      { args: [[1, 2]], expected: [1, null, 2] },
      { args: [[1, null, 2, 3]], expected: [1, 2, null, null, 3] },
      { args: [[5, 3, 8, 1, 4, 7, 9]], expected: [5, 8, 3, 9, 7, 4, 1] },
    ],
  },
  {
    slug: "maximum-subarray",
    title: "Maximum Subarray",
    difficulty: "Medium",
    topics: ["Arrays", "Dynamic programming"],
    summary: "Find the contiguous run of numbers with the largest sum.",
    description: [
      "Given an integer array `nums`, find the contiguous subarray (containing at least one number) with the largest sum, and return that sum.",
    ],
    constraints: ["`1 <= nums.length <= 10^5`", "`-10^4 <= nums[i] <= 10^4`"],
    hint: "Walk through the array keeping the best sum of a subarray that ends at the current position. If that running sum goes negative, starting fresh is better.",
    functionName: { js: "maxSubArray", py: "max_sub_array" },
    params: [{ name: "nums", type: "int[]" }],
    returns: "int",
    tests: [
      {
        args: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]],
        expected: 6,
        example: true,
        explanation: "The subarray [4, -1, 2, 1] has the largest sum, 6.",
      },
      { args: [[1]], expected: 1, example: true },
      { args: [[5, 4, -1, 7, 8]], expected: 23, example: true },
      { args: [[-3, -1, -2]], expected: -1 },
      { args: [[-2, -3, 4, -1, -2, 1, 5, -3]], expected: 7 },
      { args: [[0, 0, 0]], expected: 0 },
      { args: [[8, -19, 5, -4, 20]], expected: 21 },
    ],
  },
  {
    slug: "group-anagrams",
    title: "Group Anagrams",
    difficulty: "Medium",
    topics: ["Strings", "Hash map", "Sorting"],
    summary: "Group together words that are anagrams of each other.",
    description: [
      "Given an array of strings `words`, group the words that are anagrams of each other.",
      "You can return the groups in any order, and the words inside each group in any order.",
    ],
    constraints: ["`1 <= words.length <= 10^4`", "`0 <= words[i].length <= 100`", "Words contain only lowercase English letters."],
    hint: "Two words are anagrams exactly when their sorted letters match. Use the sorted word as a key in a hash map of groups.",
    functionName: { js: "groupAnagrams", py: "group_anagrams" },
    params: [{ name: "words", type: "str[]" }],
    returns: "str[][]",
    compare: "unordered-deep",
    tests: [
      {
        args: [["eat", "tea", "tan", "ate", "nat", "bat"]],
        expected: [["bat"], ["nat", "tan"], ["ate", "eat", "tea"]],
        example: true,
      },
      { args: [[""]], expected: [[""]], example: true },
      { args: [["a"]], expected: [["a"]], example: true },
      { args: [["abc", "bca", "cab", "xyz", "zyx", "q"]], expected: [["abc", "bca", "cab"], ["xyz", "zyx"], ["q"]] },
      { args: [["ab", "ba", "ab"]], expected: [["ab", "ba", "ab"]] },
    ],
  },
  {
    slug: "longest-substring-without-repeating-characters",
    title: "Longest Substring Without Repeats",
    difficulty: "Medium",
    topics: ["Strings", "Sliding window", "Hash map"],
    summary: "Find the longest stretch of text with no repeated character.",
    description: [
      "Given a string `s`, return the length of the longest substring that contains no repeated characters.",
      "A substring is a contiguous run of characters within the string.",
    ],
    constraints: ["`0 <= s.length <= 5 * 10^4`", "`s` may contain letters, digits, symbols and spaces."],
    hint: "Keep a window with no repeats. Extend it one character at a time, and when a character repeats, move the window's start past that character's previous position.",
    functionName: { js: "lengthOfLongestSubstring", py: "length_of_longest_substring" },
    params: [{ name: "s", type: "str" }],
    returns: "int",
    tests: [
      { args: ["abcabcbb"], expected: 3, example: true, explanation: "\"abc\" is the longest run without repeats." },
      { args: ["bbbbb"], expected: 1, example: true },
      { args: ["pwwkew"], expected: 3, example: true, explanation: "\"wke\" has length 3." },
      { args: [""], expected: 0 },
      { args: [" "], expected: 1 },
      { args: ["dvdf"], expected: 3 },
      { args: ["abba"], expected: 2 },
      { args: ["tmmzuxt"], expected: 5 },
    ],
  },
  {
    slug: "product-of-array-except-self",
    title: "Product Except Self",
    difficulty: "Medium",
    topics: ["Arrays", "Prefix sums"],
    summary: "Multiply everything except the current element, without division.",
    description: [
      "Given an integer array `nums`, return an array `answer` where `answer[i]` is the product of every element of `nums` except `nums[i]`.",
      "Solve it in `O(n)` time without using division.",
    ],
    constraints: ["`2 <= nums.length <= 10^5`", "`-30 <= nums[i] <= 30`", "Every product fits in a 32-bit integer."],
    hint: "`answer[i]` is (the product of everything to the left of `i`) times (the product of everything to the right). Build both in two passes.",
    functionName: { js: "productExceptSelf", py: "product_except_self" },
    params: [{ name: "nums", type: "int[]" }],
    returns: "int[]",
    tests: [
      { args: [[1, 2, 3, 4]], expected: [24, 12, 8, 6], example: true },
      { args: [[-1, 1, 0, -3, 3]], expected: [0, 0, 9, 0, 0], example: true },
      { args: [[2, 3]], expected: [3, 2] },
      { args: [[0, 0]], expected: [0, 0] },
      { args: [[5, 1, 1, 1]], expected: [1, 5, 5, 5] },
      { args: [[-2, -3, 4]], expected: [-12, -8, 6] },
    ],
  },
  {
    slug: "top-k-frequent-elements",
    title: "Top K Frequent Elements",
    difficulty: "Medium",
    topics: ["Hash map", "Heap", "Sorting"],
    summary: "Return the k numbers that appear most often.",
    description: [
      "Given an integer array `nums` and an integer `k`, return the `k` most frequent elements. You can return them in any order.",
      "The answer is guaranteed to be unique.",
    ],
    constraints: ["`1 <= nums.length <= 10^5`", "`1 <= k <=` the number of distinct values in `nums`"],
    hint: "Count each number's frequency. Then either sort the distinct numbers by count, or put them into buckets indexed by count.",
    functionName: { js: "topKFrequent", py: "top_k_frequent" },
    params: [
      { name: "nums", type: "int[]" },
      { name: "k", type: "int" },
    ],
    returns: "int[]",
    compare: "unordered",
    tests: [
      { args: [[1, 1, 1, 2, 2, 3], 2], expected: [1, 2], example: true },
      { args: [[1], 1], expected: [1], example: true },
      { args: [[4, 4, 4, 5, 5, 6, 6, 6, 6], 2], expected: [6, 4] },
      { args: [[-1, -1, 2, 2, 2, 3], 2], expected: [2, -1] },
      { args: [[7, 7, 8, 8, 8, 9, 9, 9, 9, 9], 3], expected: [9, 8, 7] },
    ],
  },
  {
    slug: "three-sum",
    title: "3Sum",
    difficulty: "Medium",
    topics: ["Arrays", "Two pointers", "Sorting"],
    summary: "Find every triplet of numbers that adds up to zero.",
    description: [
      "Given an integer array `nums`, return every unique triplet `[a, b, c]` of values taken from three different positions such that `a + b + c = 0`.",
      "The answer must not contain duplicate triplets. You can return the triplets in any order, and the numbers inside each triplet in any order.",
    ],
    constraints: ["`3 <= nums.length <= 3000`", "`-10^5 <= nums[i] <= 10^5`"],
    hint: "Sort the array. Fix the first number, then use two pointers on the rest to find pairs that sum to its negative. Skip repeated values to avoid duplicate triplets.",
    functionName: { js: "threeSum", py: "three_sum" },
    params: [{ name: "nums", type: "int[]" }],
    returns: "int[][]",
    compare: "unordered-deep",
    tests: [
      { args: [[-1, 0, 1, 2, -1, -4]], expected: [[-1, -1, 2], [-1, 0, 1]], example: true },
      { args: [[0, 1, 1]], expected: [], example: true, explanation: "No three numbers add up to 0." },
      { args: [[0, 0, 0]], expected: [[0, 0, 0]], example: true },
      { args: [[-2, 0, 1, 1, 2]], expected: [[-2, 0, 2], [-2, 1, 1]] },
      { args: [[1, 2, -2, -1]], expected: [] },
      { args: [[3, 0, -2, -1, 1, 2]], expected: [[-2, -1, 3], [-2, 0, 2], [-1, 0, 1]] },
      { args: [[-1, 0, 1, 0]], expected: [[-1, 0, 1]] },
    ],
  },
  {
    slug: "container-with-most-water",
    title: "Container With Most Water",
    difficulty: "Medium",
    topics: ["Arrays", "Two pointers", "Greedy"],
    summary: "Pick two walls that hold the most water between them.",
    description: [
      "You're given an array `height` where `height[i]` is the height of a vertical line at position `i`.",
      "Choose two lines that, together with the x-axis, form a container. It holds (the distance between the lines) × (the height of the shorter line) units of water. Return the most water a container can hold.",
    ],
    constraints: ["`2 <= height.length <= 10^5`", "`0 <= height[i] <= 10^4`"],
    hint: "Start with the widest container (both ends) and move the shorter wall inward. Moving the taller one can never help, because the shorter wall limits the height.",
    functionName: { js: "maxArea", py: "max_area" },
    params: [{ name: "height", type: "int[]" }],
    returns: "int",
    tests: [
      {
        args: [[1, 8, 6, 2, 5, 4, 8, 3, 7]],
        expected: 49,
        example: true,
        explanation: "The lines at positions 1 and 8 are 7 apart, and the shorter is 7 tall: 7 × 7 = 49.",
      },
      { args: [[1, 1]], expected: 1, example: true },
      { args: [[4, 3, 2, 1, 4]], expected: 16 },
      { args: [[1, 2, 1]], expected: 2 },
      { args: [[2, 3, 4, 5, 18, 17, 6]], expected: 17 },
      { args: [[0, 0, 0]], expected: 0 },
    ],
  },
  {
    slug: "longest-consecutive-sequence",
    title: "Longest Consecutive Sequence",
    difficulty: "Medium",
    topics: ["Arrays", "Hash map"],
    summary: "Find the longest run of consecutive integers, in any order.",
    description: [
      "Given an unsorted array of integers `nums`, return the length of the longest sequence of consecutive integers (like `4, 5, 6, 7`) whose values all appear in `nums`.",
      "Aim for `O(n)` time.",
    ],
    constraints: ["`0 <= nums.length <= 10^5`", "`-10^9 <= nums[i] <= 10^9`"],
    hint: "Put every number in a set. Only start counting from numbers `x` where `x - 1` is missing; those are the starts of runs.",
    functionName: { js: "longestConsecutive", py: "longest_consecutive" },
    params: [{ name: "nums", type: "int[]" }],
    returns: "int",
    tests: [
      { args: [[100, 4, 200, 1, 3, 2]], expected: 4, example: true, explanation: "The longest run is 1, 2, 3, 4." },
      { args: [[0, 3, 7, 2, 5, 8, 4, 6, 0, 1]], expected: 9, example: true },
      { args: [[]], expected: 0 },
      { args: [[1, 2, 0, 1]], expected: 3 },
      { args: [[9, 1, -3, 2, 4, 8, 3, -1, 6, -2, -4, 7]], expected: 4 },
      { args: [[5]], expected: 1 },
    ],
  },
  {
    slug: "subarray-sum-equals-k",
    title: "Subarray Sum Equals K",
    difficulty: "Medium",
    topics: ["Arrays", "Prefix sums", "Hash map"],
    summary: "Count the contiguous stretches that add up to k.",
    description: [
      "Given an integer array `nums` and an integer `k`, return the number of contiguous, non-empty subarrays whose sum equals `k`.",
    ],
    constraints: ["`1 <= nums.length <= 2 * 10^4`", "`-1000 <= nums[i] <= 1000`", "`-10^7 <= k <= 10^7`"],
    hint: "Keep a hash map counting the running prefix sums seen so far. A subarray ending here adds up to `k` whenever `prefix - k` appeared earlier.",
    functionName: { js: "subarraySum", py: "subarray_sum" },
    params: [
      { name: "nums", type: "int[]" },
      { name: "k", type: "int" },
    ],
    returns: "int",
    tests: [
      { args: [[1, 1, 1], 2], expected: 2, example: true },
      { args: [[1, 2, 3], 3], expected: 2, example: true, explanation: "[1, 2] and [3] both add up to 3." },
      { args: [[1], 0], expected: 0 },
      { args: [[1, -1, 0], 0], expected: 3 },
      { args: [[3, 4, 7, 2, -3, 1, 4, 2], 7], expected: 4 },
      { args: [[0, 0, 0], 0], expected: 6 },
    ],
  },
  {
    slug: "merge-intervals",
    title: "Merge Intervals",
    difficulty: "Medium",
    topics: ["Arrays", "Sorting", "Intervals"],
    summary: "Combine overlapping ranges into one sorted list.",
    description: [
      "Given an array of `intervals` where `intervals[i] = [start, end]`, merge every group of overlapping intervals and return the non-overlapping result, sorted by start.",
      "Intervals that touch at an endpoint, like `[1, 4]` and `[4, 5]`, count as overlapping.",
    ],
    constraints: ["`1 <= intervals.length <= 10^4`", "`0 <= start <= end <= 10^4`"],
    hint: "Sort the intervals by start. Then walk through them: each one either extends the last merged interval or starts a new one.",
    functionName: { js: "merge", py: "merge" },
    params: [{ name: "intervals", type: "int[][]" }],
    returns: "int[][]",
    tests: [
      {
        args: [[[1, 3], [2, 6], [8, 10], [15, 18]]],
        expected: [[1, 6], [8, 10], [15, 18]],
        example: true,
        explanation: "[1, 3] and [2, 6] overlap, so they merge into [1, 6].",
      },
      { args: [[[1, 4], [4, 5]]], expected: [[1, 5]], example: true },
      { args: [[[4, 7], [1, 4]]], expected: [[1, 7]], example: true },
      { args: [[[1, 4], [2, 3]]], expected: [[1, 4]] },
      { args: [[[1, 2]]], expected: [[1, 2]] },
      { args: [[[5, 6], [1, 2], [3, 4]]], expected: [[1, 2], [3, 4], [5, 6]] },
      { args: [[[1, 10], [2, 3], [4, 5], [11, 12]]], expected: [[1, 10], [11, 12]] },
    ],
  },
  {
    slug: "insert-interval",
    title: "Insert Interval",
    difficulty: "Medium",
    topics: ["Arrays", "Intervals"],
    summary: "Add a new range to a sorted list of ranges, merging where needed.",
    description: [
      "You're given an array of non-overlapping `intervals` sorted by start, where `intervals[i] = [start, end]`, and one more interval, `newInterval`.",
      "Insert `newInterval` so the list stays sorted and non-overlapping, merging intervals where necessary, and return the result. Intervals that touch at an endpoint count as overlapping.",
    ],
    constraints: [
      "`0 <= intervals.length <= 10^4`",
      "`0 <= start <= end <= 10^5`",
      "`intervals` is sorted by start and has no overlaps.",
    ],
    hint: "Copy the intervals that end before the new one starts, merge every interval that overlaps it into a single range, then copy the rest.",
    functionName: { js: "insert", py: "insert" },
    params: [
      { name: "intervals", type: "int[][]" },
      { name: "newInterval", type: "int[]" },
    ],
    returns: "int[][]",
    tests: [
      { args: [[[1, 3], [6, 9]], [2, 5]], expected: [[1, 5], [6, 9]], example: true },
      {
        args: [[[1, 2], [3, 5], [6, 7], [8, 10], [12, 16]], [4, 8]],
        expected: [[1, 2], [3, 10], [12, 16]],
        example: true,
        explanation: "[4, 8] overlaps [3, 5], [6, 7] and [8, 10], so they merge into [3, 10].",
      },
      { args: [[], [5, 7]], expected: [[5, 7]], example: true },
      { args: [[[1, 5]], [2, 3]], expected: [[1, 5]] },
      { args: [[[1, 5]], [6, 8]], expected: [[1, 5], [6, 8]] },
      { args: [[[3, 5], [8, 10]], [1, 2]], expected: [[1, 2], [3, 5], [8, 10]] },
      { args: [[[1, 2], [5, 6]], [2, 5]], expected: [[1, 6]] },
    ],
  },
  {
    slug: "search-in-rotated-sorted-array",
    title: "Search in Rotated Sorted Array",
    difficulty: "Medium",
    topics: ["Arrays", "Binary search"],
    summary: "Binary search in a sorted array that has been rotated.",
    description: [
      "An array of distinct integers, sorted in ascending order, has been rotated at some unknown pivot. For example, `[0, 1, 2, 4, 5, 6, 7]` might become `[4, 5, 6, 7, 0, 1, 2]`.",
      "Given the rotated array `nums` and an integer `target`, return the index of `target`, or `-1` if it isn't in `nums`. Aim for `O(log n)` time.",
    ],
    constraints: ["`1 <= nums.length <= 5000`", "`-10^4 <= nums[i], target <= 10^4`", "All values in `nums` are distinct."],
    hint: "At every step of a binary search, at least one half of the range is sorted. Check whether `target` falls inside that sorted half to decide which half to keep.",
    functionName: { js: "searchRotated", py: "search_rotated" },
    params: [
      { name: "nums", type: "int[]" },
      { name: "target", type: "int" },
    ],
    returns: "int",
    tests: [
      { args: [[4, 5, 6, 7, 0, 1, 2], 0], expected: 4, example: true },
      { args: [[4, 5, 6, 7, 0, 1, 2], 3], expected: -1, example: true },
      { args: [[1], 0], expected: -1, example: true },
      { args: [[1], 1], expected: 0 },
      { args: [[3, 1], 1], expected: 1 },
      { args: [[5, 1, 3], 5], expected: 0 },
      { args: [[6, 7, 8, 1, 2, 3, 4, 5], 8], expected: 2 },
      { args: [[6, 7, 8, 1, 2, 3, 4, 5], 4], expected: 6 },
    ],
  },
  {
    slug: "daily-temperatures",
    title: "Daily Temperatures",
    difficulty: "Medium",
    topics: ["Arrays", "Stack"],
    summary: "For each day, count how long until a warmer day arrives.",
    description: [
      "Given an array `temperatures` of daily temperatures, return an array `answer` where `answer[i]` is the number of days you have to wait after day `i` for a warmer temperature.",
      "If no warmer day comes later, `answer[i]` is `0`.",
    ],
    constraints: ["`1 <= temperatures.length <= 10^5`", "`30 <= temperatures[i] <= 100`"],
    hint: "Keep a stack of days still waiting for a warmer day, with temperatures decreasing from bottom to top. Each new day resolves every waiting day that is colder than it.",
    functionName: { js: "dailyTemperatures", py: "daily_temperatures" },
    params: [{ name: "temperatures", type: "int[]" }],
    returns: "int[]",
    tests: [
      { args: [[73, 74, 75, 71, 69, 72, 76, 73]], expected: [1, 1, 4, 2, 1, 1, 0, 0], example: true },
      { args: [[30, 40, 50, 60]], expected: [1, 1, 1, 0], example: true },
      { args: [[30, 60, 90]], expected: [1, 1, 0], example: true },
      { args: [[90, 80, 70]], expected: [0, 0, 0] },
      { args: [[50]], expected: [0] },
      { args: [[55, 38, 53, 81, 61, 93, 97, 32, 43, 78]], expected: [3, 1, 1, 2, 1, 1, 0, 1, 1, 0] },
    ],
  },
  {
    slug: "kth-largest-element-in-an-array",
    title: "Kth Largest Element",
    difficulty: "Medium",
    topics: ["Arrays", "Heap", "Sorting"],
    summary: "Find the kth largest number without fully sorting.",
    description: [
      "Given an integer array `nums` and an integer `k`, return the `k`th largest element in the array.",
      "This means the `k`th largest in sorted order, not the `k`th largest distinct value. Can you do better than sorting everything?",
    ],
    constraints: ["`1 <= k <= nums.length <= 10^5`", "`-10^4 <= nums[i] <= 10^4`"],
    hint: "Keep a min-heap of the `k` largest numbers seen so far; its smallest element is the answer. Quickselect is another option, with linear time on average.",
    functionName: { js: "findKthLargest", py: "find_kth_largest" },
    params: [
      { name: "nums", type: "int[]" },
      { name: "k", type: "int" },
    ],
    returns: "int",
    tests: [
      { args: [[3, 2, 1, 5, 6, 4], 2], expected: 5, example: true },
      { args: [[3, 2, 3, 1, 2, 4, 5, 5, 6], 4], expected: 4, example: true },
      { args: [[1], 1], expected: 1 },
      { args: [[7, 7, 7, 7], 2], expected: 7 },
      { args: [[-1, -5, -3], 1], expected: -1 },
      { args: [[9, 1, 8, 2, 7, 3, 6, 4, 5], 9], expected: 1 },
    ],
  },
  {
    slug: "coin-change",
    title: "Coin Change",
    difficulty: "Medium",
    topics: ["Dynamic programming"],
    summary: "Make an amount with as few coins as possible.",
    description: [
      "You're given coin denominations `coins` and a target `amount`. Return the fewest coins needed to make exactly `amount`, or `-1` if it can't be done.",
      "You have an unlimited supply of every denomination.",
    ],
    constraints: ["`1 <= coins.length <= 12`", "`1 <= coins[i] <= 2^31 - 1`", "`0 <= amount <= 10^4`"],
    hint: "Let `best[x]` be the fewest coins that make `x`. Then `best[x]` is 1 plus the minimum of `best[x - coin]` over every coin.",
    functionName: { js: "coinChange", py: "coin_change" },
    params: [
      { name: "coins", type: "int[]" },
      { name: "amount", type: "int" },
    ],
    returns: "int",
    tests: [
      { args: [[1, 2, 5], 11], expected: 3, example: true, explanation: "11 = 5 + 5 + 1." },
      { args: [[2], 3], expected: -1, example: true },
      { args: [[1], 0], expected: 0, example: true },
      { args: [[2, 5, 10, 1], 27], expected: 4 },
      { args: [[186, 419, 83, 408], 6249], expected: 20 },
      { args: [[3, 7], 5], expected: -1 },
      { args: [[1, 3, 4], 6], expected: 2 },
    ],
  },
  {
    slug: "house-robber",
    title: "House Robber",
    difficulty: "Medium",
    topics: ["Dynamic programming"],
    summary: "Collect the most money without ever taking from two neighbours.",
    description: [
      "Each house on a street has some money stashed in it, given by `nums`. You may take the money from any set of houses, as long as you never take from two houses that are next to each other.",
      "Return the largest total you can collect.",
    ],
    constraints: ["`1 <= nums.length <= 100`", "`0 <= nums[i] <= 400`"],
    hint: "For each house, the best total is either the best total up to the previous house, or this house's money plus the best total up to two houses back.",
    functionName: { js: "rob", py: "rob" },
    params: [{ name: "nums", type: "int[]" }],
    returns: "int",
    tests: [
      { args: [[1, 2, 3, 1]], expected: 4, example: true, explanation: "Take houses 0 and 2: 1 + 3 = 4." },
      { args: [[2, 7, 9, 3, 1]], expected: 12, example: true, explanation: "Take houses 0, 2 and 4: 2 + 9 + 1 = 12." },
      { args: [[5]], expected: 5 },
      { args: [[2, 1, 1, 2]], expected: 4 },
      { args: [[0, 0, 0]], expected: 0 },
      { args: [[6, 1, 2, 7]], expected: 13 },
      { args: [[100, 1, 1, 100]], expected: 200 },
    ],
  },
  {
    slug: "word-break",
    title: "Word Break",
    difficulty: "Medium",
    topics: ["Strings", "Dynamic programming"],
    summary: "Decide whether a string can be split into dictionary words.",
    description: [
      "Given a string `s` and a dictionary `words`, return `true` if `s` can be split into a sequence of one or more dictionary words, and `false` otherwise.",
      "The same dictionary word may be used more than once.",
    ],
    constraints: ["`1 <= s.length <= 300`", "`1 <= words.length <= 1000`", "All strings contain only lowercase English letters."],
    hint: "Let `ok[i]` mean the first `i` characters can be split. Then `ok[i]` is true when some earlier `ok[j]` is true and the piece from `j` to `i` is a dictionary word.",
    functionName: { js: "wordBreak", py: "word_break" },
    params: [
      { name: "s", type: "str" },
      { name: "words", type: "str[]" },
    ],
    returns: "bool",
    tests: [
      {
        args: ["codeshare", ["code", "share"]],
        expected: true,
        example: true,
        explanation: "\"codeshare\" is \"code\" + \"share\".",
      },
      {
        args: ["applepenapple", ["apple", "pen"]],
        expected: true,
        example: true,
        explanation: "Words can repeat: \"apple\" + \"pen\" + \"apple\".",
      },
      { args: ["catsandog", ["cats", "dog", "sand", "and", "cat"]], expected: false, example: true },
      { args: ["a", ["b"]], expected: false },
      { args: ["aaaaaaa", ["aaaa", "aaa"]], expected: true },
      { args: ["cars", ["car", "ca", "rs"]], expected: true },
      { args: ["goalspecial", ["go", "goal", "goals", "special"]], expected: true },
    ],
  },
  {
    slug: "subsets",
    title: "Subsets",
    difficulty: "Medium",
    topics: ["Backtracking", "Bit manipulation"],
    summary: "List every possible subset of a set of numbers.",
    description: [
      "Given an array `nums` of distinct integers, return every possible subset (the power set), including the empty one.",
      "The answer must not contain duplicate subsets. You can return the subsets in any order, and the numbers inside each subset in any order.",
    ],
    constraints: ["`1 <= nums.length <= 10`", "`-10 <= nums[i] <= 10`", "All numbers in `nums` are distinct."],
    hint: "Each number is either in a subset or not. Start from `[[]]` and, for each number, add a copy of every existing subset with that number appended.",
    functionName: { js: "subsets", py: "subsets" },
    params: [{ name: "nums", type: "int[]" }],
    returns: "int[][]",
    compare: "unordered-deep",
    tests: [
      { args: [[1, 2, 3]], expected: [[], [1], [2], [1, 2], [3], [1, 3], [2, 3], [1, 2, 3]], example: true },
      { args: [[0]], expected: [[], [0]], example: true },
      { args: [[5, -1]], expected: [[], [5], [-1], [5, -1]] },
      {
        args: [[1, 2, 3, 4]],
        expected: [
          [],
          [1],
          [2],
          [3],
          [4],
          [1, 2],
          [1, 3],
          [1, 4],
          [2, 3],
          [2, 4],
          [3, 4],
          [1, 2, 3],
          [1, 2, 4],
          [1, 3, 4],
          [2, 3, 4],
          [1, 2, 3, 4],
        ],
      },
    ],
  },
  {
    slug: "permutations",
    title: "Permutations",
    difficulty: "Medium",
    topics: ["Backtracking"],
    summary: "List every ordering of a set of numbers.",
    description: ["Given an array `nums` of distinct integers, return every possible permutation. You can return them in any order."],
    constraints: ["`1 <= nums.length <= 6`", "`-10 <= nums[i] <= 10`", "All numbers in `nums` are distinct."],
    hint: "Build permutations one position at a time. At each step try every number that isn't used yet, recurse, then undo the choice (backtrack).",
    functionName: { js: "permute", py: "permute" },
    params: [{ name: "nums", type: "int[]" }],
    returns: "int[][]",
    compare: "unordered",
    tests: [
      {
        args: [[1, 2, 3]],
        expected: [
          [1, 2, 3],
          [1, 3, 2],
          [2, 1, 3],
          [2, 3, 1],
          [3, 1, 2],
          [3, 2, 1],
        ],
        example: true,
      },
      { args: [[0, 1]], expected: [[0, 1], [1, 0]], example: true },
      { args: [[1]], expected: [[1]], example: true },
      { args: [[-1, 2]], expected: [[-1, 2], [2, -1]] },
      {
        args: [[4, 5, 6]],
        expected: [
          [4, 5, 6],
          [4, 6, 5],
          [5, 4, 6],
          [5, 6, 4],
          [6, 4, 5],
          [6, 5, 4],
        ],
      },
    ],
  },
  {
    slug: "combination-sum",
    title: "Combination Sum",
    difficulty: "Medium",
    topics: ["Backtracking"],
    summary: "Find every combination that adds up to a target, reusing numbers freely.",
    description: [
      "Given an array of distinct positive integers `candidates` and a `target`, return every unique combination of candidates that adds up to `target`. The same number may be used any number of times.",
      "Two combinations are the same if they use each number the same number of times. You can return the combinations in any order, and the numbers inside each combination in any order.",
    ],
    constraints: [
      "`1 <= candidates.length <= 30`",
      "`2 <= candidates[i] <= 40`",
      "All candidates are distinct.",
      "`1 <= target <= 40`",
    ],
    hint: "Backtrack over the candidates in order. At each step either use the current number again or move on to the next one, so each combination is built only once.",
    functionName: { js: "combinationSum", py: "combination_sum" },
    params: [
      { name: "candidates", type: "int[]" },
      { name: "target", type: "int" },
    ],
    returns: "int[][]",
    compare: "unordered-deep",
    tests: [
      { args: [[2, 3, 6, 7], 7], expected: [[2, 2, 3], [7]], example: true },
      { args: [[2, 3, 5], 8], expected: [[2, 2, 2, 2], [2, 3, 3], [3, 5]], example: true },
      { args: [[2], 1], expected: [], example: true },
      { args: [[3, 4, 5], 10], expected: [[3, 3, 4], [5, 5]] },
      { args: [[7, 8], 15], expected: [[7, 8]] },
      { args: [[2, 3], 6], expected: [[2, 2, 2], [3, 3]] },
    ],
  },
  {
    slug: "number-of-islands",
    title: "Number of Islands",
    difficulty: "Medium",
    topics: ["Graphs", "Matrix"],
    summary: "Count the groups of connected land on a map.",
    description: [
      "You're given a 2D `grid` of `1`s (land) and `0`s (water). An island is a group of land cells connected horizontally or vertically. Return the number of islands.",
      "Everything outside the grid counts as water, and diagonal neighbours are not connected.",
    ],
    constraints: ["`1 <= grid.length, grid[i].length <= 300`", "`grid[i][j]` is `0` or `1`."],
    hint: "Scan every cell. When you find unvisited land, count a new island and flood-fill (DFS or BFS) to mark all the land connected to it.",
    functionName: { js: "numIslands", py: "num_islands" },
    params: [{ name: "grid", type: "int[][]" }],
    returns: "int",
    tests: [
      {
        args: [[[1, 1, 1, 1, 0], [1, 1, 0, 1, 0], [1, 1, 0, 0, 0], [0, 0, 0, 0, 0]]],
        expected: 1,
        example: true,
      },
      {
        args: [[[1, 1, 0, 0, 0], [1, 1, 0, 0, 0], [0, 0, 1, 0, 0], [0, 0, 0, 1, 1]]],
        expected: 3,
        example: true,
      },
      { args: [[[0]]], expected: 0 },
      { args: [[[1]]], expected: 1 },
      { args: [[[1, 0, 1], [0, 1, 0], [1, 0, 1]]], expected: 5 },
      { args: [[[1, 1, 1], [0, 1, 0], [1, 1, 1]]], expected: 1 },
    ],
  },
  {
    slug: "rotting-oranges",
    title: "Rotting Oranges",
    difficulty: "Medium",
    topics: ["Graphs", "Matrix", "Queue"],
    summary: "Find how many minutes it takes for rot to spread to every orange.",
    description: [
      "You're given a grid where each cell is `0` (empty), `1` (a fresh orange) or `2` (a rotten orange). Every minute, each fresh orange next to a rotten one (up, down, left or right) becomes rotten.",
      "Return the minimum number of minutes until no fresh orange remains. If that can never happen, return `-1`.",
    ],
    constraints: ["`1 <= grid.length, grid[i].length <= 10`", "`grid[i][j]` is `0`, `1` or `2`."],
    hint: "Run a breadth-first search starting from all the rotten oranges at once. Each BFS layer is one minute; afterwards, check whether any fresh orange was never reached.",
    functionName: { js: "orangesRotting", py: "oranges_rotting" },
    params: [{ name: "grid", type: "int[][]" }],
    returns: "int",
    tests: [
      {
        args: [
          [
            [2, 1, 1],
            [1, 1, 0],
            [0, 1, 1],
          ],
        ],
        expected: 4,
        example: true,
      },
      {
        args: [
          [
            [2, 1, 1],
            [0, 1, 1],
            [1, 0, 1],
          ],
        ],
        expected: -1,
        example: true,
        explanation: "The orange in the bottom-left corner is never reached.",
      },
      { args: [[[0, 2]]], expected: 0, example: true, explanation: "There are no fresh oranges to begin with." },
      { args: [[[1]]], expected: -1 },
      {
        args: [
          [
            [2, 2],
            [1, 1],
          ],
        ],
        expected: 1,
      },
      { args: [[[2, 1, 0, 1, 2]]], expected: 1 },
      {
        args: [
          [
            [1, 1, 1],
            [1, 2, 1],
            [1, 1, 1],
          ],
        ],
        expected: 2,
      },
    ],
  },
  {
    slug: "course-schedule",
    title: "Course Schedule",
    difficulty: "Medium",
    topics: ["Graphs"],
    summary: "Decide whether every course can be finished, given the prerequisites.",
    description: [
      "There are `numCourses` courses labeled `0` to `numCourses - 1`. You're given an array `prerequisites` where `prerequisites[i] = [a, b]` means course `b` must be taken before course `a`.",
      "Return `true` if it's possible to finish every course, and `false` otherwise.",
    ],
    constraints: ["`1 <= numCourses <= 2000`", "`0 <= prerequisites.length <= 5000`", "All pairs `[a, b]` are distinct."],
    hint: "This is cycle detection in a directed graph. Repeatedly take the courses with no remaining prerequisites (Kahn's algorithm); if some courses never become available, there's a cycle.",
    functionName: { js: "canFinish", py: "can_finish" },
    params: [
      { name: "numCourses", type: "int" },
      { name: "prerequisites", type: "int[][]" },
    ],
    returns: "bool",
    tests: [
      { args: [2, [[1, 0]]], expected: true, example: true, explanation: "Take course 0, then course 1." },
      {
        args: [
          2,
          [
            [1, 0],
            [0, 1],
          ],
        ],
        expected: false,
        example: true,
        explanation: "Each course needs the other one first, so neither can start.",
      },
      { args: [1, []], expected: true },
      {
        args: [
          3,
          [
            [1, 0],
            [2, 1],
          ],
        ],
        expected: true,
      },
      {
        args: [
          3,
          [
            [0, 1],
            [1, 2],
            [2, 0],
          ],
        ],
        expected: false,
      },
      {
        args: [
          4,
          [
            [1, 0],
            [2, 0],
            [3, 1],
            [3, 2],
          ],
        ],
        expected: true,
      },
      {
        args: [
          5,
          [
            [1, 4],
            [2, 4],
            [3, 1],
            [3, 2],
            [4, 3],
          ],
        ],
        expected: false,
      },
    ],
  },
  {
    slug: "number-of-connected-components",
    title: "Connected Components",
    difficulty: "Medium",
    topics: ["Graphs", "Union find"],
    summary: "Count the separate groups in an undirected graph.",
    description: [
      "There are `n` nodes labeled `0` to `n - 1`, and an array `edges` where `edges[i] = [a, b]` is an undirected edge between nodes `a` and `b`.",
      "Return the number of connected components in the graph.",
    ],
    constraints: ["`1 <= n <= 2000`", "`0 <= edges.length <= 5000`", "No edge is repeated, and there are no self-loops."],
    hint: "Union-find works well: start with every node in its own set, merge the sets at the two ends of each edge, and count how many merges actually join two different sets.",
    functionName: { js: "countComponents", py: "count_components" },
    params: [
      { name: "n", type: "int" },
      { name: "edges", type: "int[][]" },
    ],
    returns: "int",
    tests: [
      {
        args: [
          5,
          [
            [0, 1],
            [1, 2],
            [3, 4],
          ],
        ],
        expected: 2,
        example: true,
      },
      {
        args: [
          5,
          [
            [0, 1],
            [1, 2],
            [2, 3],
            [3, 4],
          ],
        ],
        expected: 1,
        example: true,
      },
      { args: [3, []], expected: 3, example: true, explanation: "With no edges, every node is its own component." },
      { args: [1, []], expected: 1 },
      {
        args: [
          6,
          [
            [0, 1],
            [2, 3],
            [4, 5],
            [1, 2],
          ],
        ],
        expected: 2,
      },
      {
        args: [
          4,
          [
            [0, 1],
            [1, 2],
            [2, 0],
          ],
        ],
        expected: 2,
      },
    ],
  },
  {
    slug: "rotate-image",
    title: "Rotate Image",
    difficulty: "Medium",
    topics: ["Matrix", "Arrays"],
    summary: "Turn a square matrix 90 degrees clockwise, in place.",
    description: [
      "You're given an `n × n` matrix representing an image. Rotate it 90 degrees clockwise.",
      "Do this **in place**: change `matrix` directly instead of building a new one. The tests check `matrix` after your function finishes.",
    ],
    constraints: ["`1 <= n <= 20`", "`-1000 <= matrix[i][j] <= 1000`"],
    hint: "A clockwise rotation is the same as transposing the matrix (swapping `matrix[i][j]` with `matrix[j][i]`) and then reversing each row.",
    functionName: { js: "rotate", py: "rotate" },
    params: [{ name: "matrix", type: "int[][]" }],
    returns: "void",
    outputArg: 0,
    tests: [
      {
        args: [
          [
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 9],
          ],
        ],
        expected: [
          [7, 4, 1],
          [8, 5, 2],
          [9, 6, 3],
        ],
        example: true,
      },
      {
        args: [
          [
            [5, 1, 9, 11],
            [2, 4, 8, 10],
            [13, 3, 6, 7],
            [15, 14, 12, 16],
          ],
        ],
        expected: [
          [15, 13, 2, 5],
          [14, 3, 4, 1],
          [12, 6, 8, 9],
          [16, 7, 10, 11],
        ],
        example: true,
      },
      { args: [[[1]]], expected: [[1]] },
      {
        args: [
          [
            [1, 2],
            [3, 4],
          ],
        ],
        expected: [
          [3, 1],
          [4, 2],
        ],
      },
    ],
  },
  {
    slug: "remove-nth-node-from-end-of-list",
    title: "Remove Nth Node From End",
    difficulty: "Medium",
    topics: ["Linked list", "Two pointers"],
    summary: "Delete the node that is n places from the end of a linked list.",
    description: [
      "Given the `head` of a linked list, remove the `n`th node from the end of the list and return the head.",
      "Lists are written as arrays: `[1, 2, 3]` means `1 → 2 → 3`.",
    ],
    constraints: ["The list has between `1` and `30` nodes.", "`0 <= Node.val <= 100`", "`1 <= n <=` the length of the list"],
    hint: "Move a `fast` pointer `n` steps ahead, then move `fast` and `slow` together until `fast` reaches the end. A dummy node before the head makes removing the first node easy.",
    functionName: { js: "removeNthFromEnd", py: "remove_nth_from_end" },
    params: [
      { name: "head", type: "list" },
      { name: "n", type: "int" },
    ],
    returns: "list",
    tests: [
      { args: [[1, 2, 3, 4, 5], 2], expected: [1, 2, 3, 5], example: true },
      { args: [[1], 1], expected: [], example: true },
      { args: [[1, 2], 1], expected: [1], example: true },
      { args: [[1, 2], 2], expected: [2] },
      { args: [[10, 20, 30], 3], expected: [20, 30] },
      { args: [[4, 5, 6, 7], 1], expected: [4, 5, 6] },
    ],
  },
  {
    slug: "binary-tree-level-order-traversal",
    title: "Level Order Traversal",
    difficulty: "Medium",
    topics: ["Trees", "Queue"],
    summary: "Read a binary tree level by level, left to right.",
    description: [
      "Given the `root` of a binary tree, return its values level by level: an array of levels, each listing that level's values from left to right.",
      "Trees are written level by level, with `null` for a missing child.",
    ],
    constraints: ["The tree has between `0` and `2000` nodes.", "`-1000 <= Node.val <= 1000`"],
    hint: "Use a queue. Handle one level at a time: note how many nodes are in the queue, pop exactly that many, and push their children.",
    functionName: { js: "levelOrder", py: "level_order" },
    params: [{ name: "root", type: "tree" }],
    returns: "int[][]",
    tests: [
      { args: [[3, 9, 20, null, null, 15, 7]], expected: [[3], [9, 20], [15, 7]], example: true },
      { args: [[1]], expected: [[1]], example: true },
      { args: [[]], expected: [], example: true },
      { args: [[1, 2, 3, 4, null, null, 5]], expected: [[1], [2, 3], [4, 5]] },
      { args: [[1, 2, null, 3, null, 4]], expected: [[1], [2], [3], [4]] },
      {
        args: [[5, 4, 8, 11, null, 13, 4, 7, 2, null, null, null, 1]],
        expected: [[5], [4, 8], [11, 13, 4], [7, 2, 1]],
      },
    ],
  },
  {
    slug: "validate-binary-search-tree",
    title: "Validate Binary Search Tree",
    difficulty: "Medium",
    topics: ["Trees"],
    summary: "Check whether a binary tree follows the search-tree ordering rule.",
    description: [
      "Given the `root` of a binary tree, decide whether it is a valid binary search tree (BST).",
      "In a valid BST, a node's left subtree contains only values strictly less than the node's value, its right subtree contains only values strictly greater, and both subtrees are valid BSTs themselves.",
    ],
    constraints: ["The tree has between `1` and `10^4` nodes.", "`-2^31 <= Node.val <= 2^31 - 1`"],
    hint: "Comparing each node with its direct children isn't enough. Pass down the range `(low, high)` that each subtree must fall within, or check that an in-order traversal is strictly increasing.",
    functionName: { js: "isValidBST", py: "is_valid_bst" },
    params: [{ name: "root", type: "tree" }],
    returns: "bool",
    tests: [
      { args: [[2, 1, 3]], expected: true, example: true },
      {
        args: [[5, 1, 4, null, null, 3, 6]],
        expected: false,
        example: true,
        explanation: "The root is 5, but its right child 4 is smaller than 5.",
      },
      { args: [[1]], expected: true },
      { args: [[1, 1]], expected: false },
      { args: [[5, 4, 6, null, null, 3, 7]], expected: false },
      { args: [[10, 5, 15, 2, 7, 12, 20]], expected: true },
      { args: [[2147483647]], expected: true },
    ],
  },
  {
    slug: "trapping-rain-water",
    title: "Trapping Rain Water",
    difficulty: "Hard",
    topics: ["Arrays", "Two pointers"],
    summary: "Measure how much rain an elevation map can hold.",
    description: [
      "Given `n` non-negative integers `height` describing an elevation map where every bar has width 1, compute how much water it can trap after it rains.",
    ],
    constraints: ["`1 <= height.length <= 2 * 10^4`", "`0 <= height[i] <= 10^5`"],
    hint: "The water above a bar is `min(tallest bar to its left, tallest bar to its right) - its own height`. Two pointers moving inward can track both maximums in one pass.",
    functionName: { js: "trap", py: "trap" },
    params: [{ name: "height", type: "int[]" }],
    returns: "int",
    tests: [
      { args: [[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]], expected: 6, example: true },
      { args: [[4, 2, 0, 3, 2, 5]], expected: 9, example: true },
      { args: [[1]], expected: 0 },
      { args: [[2, 0, 2]], expected: 2 },
      { args: [[3, 0, 0, 2, 0, 4]], expected: 10 },
      { args: [[5, 4, 3, 2, 1]], expected: 0 },
      { args: [[0, 3, 0, 1, 0, 3]], expected: 8 },
    ],
  },
  {
    slug: "largest-rectangle-in-histogram",
    title: "Largest Rectangle in Histogram",
    difficulty: "Hard",
    topics: ["Arrays", "Stack"],
    summary: "Find the biggest rectangle that fits under a bar chart.",
    description: [
      "Given an array `heights` describing a histogram where every bar has width 1, return the area of the largest rectangle that fits entirely inside the histogram.",
    ],
    constraints: ["`1 <= heights.length <= 10^5`", "`0 <= heights[i] <= 10^4`"],
    hint: "Keep a stack of bars with increasing heights. When a shorter bar arrives, pop the taller bars; each popped bar's rectangle stretches from the new top of the stack to the current position.",
    functionName: { js: "largestRectangleArea", py: "largest_rectangle_area" },
    params: [{ name: "heights", type: "int[]" }],
    returns: "int",
    tests: [
      {
        args: [[2, 1, 5, 6, 2, 3]],
        expected: 10,
        example: true,
        explanation: "The bars of height 5 and 6 make a 2 × 5 rectangle.",
      },
      { args: [[2, 4]], expected: 4, example: true },
      { args: [[1]], expected: 1 },
      { args: [[2, 2, 2, 2]], expected: 8 },
      { args: [[6, 2, 5, 4, 5, 1, 6]], expected: 12 },
      { args: [[0, 9]], expected: 9 },
      { args: [[4, 2, 0, 3, 2, 5]], expected: 6 },
    ],
  },
  {
    slug: "sliding-window-maximum",
    title: "Sliding Window Maximum",
    difficulty: "Hard",
    topics: ["Sliding window", "Queue"],
    summary: "Report the largest number in every window of size k.",
    description: [
      "Given an integer array `nums` and a window size `k`, slide the window from the left end of the array to the right end, one position at a time.",
      "Return an array holding the maximum value inside the window at each position.",
    ],
    constraints: ["`1 <= nums.length <= 10^5`", "`-10^4 <= nums[i] <= 10^4`", "`1 <= k <= nums.length`"],
    hint: "Keep a double-ended queue of indices whose values are decreasing. Drop indices that leave the window from the front, and smaller values from the back before adding a new index.",
    functionName: { js: "maxSlidingWindow", py: "max_sliding_window" },
    params: [
      { name: "nums", type: "int[]" },
      { name: "k", type: "int" },
    ],
    returns: "int[]",
    tests: [
      { args: [[1, 3, -1, -3, 5, 3, 6, 7], 3], expected: [3, 3, 5, 5, 6, 7], example: true },
      { args: [[1], 1], expected: [1], example: true },
      { args: [[9, 8, 7, 6], 2], expected: [9, 8, 7] },
      { args: [[1, 2, 3, 4], 4], expected: [4] },
      { args: [[4, -2], 2], expected: [4] },
      { args: [[7, 2, 4], 1], expected: [7, 2, 4] },
    ],
  },
  {
    slug: "minimum-window-substring",
    title: "Minimum Window Substring",
    difficulty: "Hard",
    topics: ["Strings", "Sliding window", "Hash map"],
    summary: "Find the shortest stretch of text containing every required letter.",
    description: [
      "Given strings `s` and `t`, return the shortest substring of `s` that contains every character of `t`, including duplicates. If no such substring exists, return an empty string.",
      "When an answer exists, it is guaranteed to be unique.",
    ],
    constraints: ["`1 <= s.length, t.length <= 10^5`", "`s` and `t` contain uppercase and lowercase English letters."],
    hint: "Grow a window to the right until it contains everything in `t`, then shrink it from the left as far as it stays valid. Track the smallest valid window you see.",
    functionName: { js: "minWindow", py: "min_window" },
    params: [
      { name: "s", type: "str" },
      { name: "t", type: "str" },
    ],
    returns: "str",
    tests: [
      { args: ["ADOBECODEBANC", "ABC"], expected: "BANC", example: true },
      { args: ["a", "a"], expected: "a", example: true },
      { args: ["a", "aa"], expected: "", example: true, explanation: "t needs two a's, but s only has one." },
      { args: ["ab", "b"], expected: "b" },
      { args: ["aa", "aa"], expected: "aa" },
      { args: ["xyzabcxyz", "zax"], expected: "xyza" },
    ],
  },
  {
    slug: "median-of-two-sorted-arrays",
    title: "Median of Two Sorted Arrays",
    difficulty: "Hard",
    topics: ["Arrays", "Binary search"],
    summary: "Find the median of two sorted arrays combined.",
    description: [
      "Given two sorted arrays `nums1` and `nums2`, return the median of the two arrays combined.",
      "The median is the middle value of the combined sorted list, or the average of the two middle values when its length is even. Aim for `O(log (m + n))` time.",
    ],
    constraints: [
      "`0 <= nums1.length, nums2.length <= 1000`",
      "`1 <= nums1.length + nums2.length <= 2000`",
      "`-10^6 <= nums1[i], nums2[i] <= 10^6`",
    ],
    hint: "Binary search for a split of the shorter array such that everything left of the split in both arrays is no bigger than everything to the right.",
    functionName: { js: "findMedianSortedArrays", py: "find_median_sorted_arrays" },
    params: [
      { name: "nums1", type: "int[]" },
      { name: "nums2", type: "int[]" },
    ],
    returns: "float",
    tests: [
      { args: [[1, 3], [2]], expected: 2, example: true, explanation: "Combined, the array is [1, 2, 3], so the median is 2." },
      {
        args: [[1, 2], [3, 4]],
        expected: 2.5,
        example: true,
        explanation: "Combined, the array is [1, 2, 3, 4], so the median is (2 + 3) / 2 = 2.5.",
      },
      { args: [[], [1]], expected: 1 },
      { args: [[2], []], expected: 2 },
      { args: [[0, 0], [0, 0]], expected: 0 },
      { args: [[1, 5, 9], [2, 3, 10, 11]], expected: 5 },
      { args: [[-5, -3, -1], [-2, 4]], expected: -2 },
      { args: [[1, 2], [1, 2, 3]], expected: 2 },
    ],
  },
  {
    slug: "merge-k-sorted-lists",
    title: "Merge K Sorted Lists",
    difficulty: "Hard",
    topics: ["Linked list", "Heap"],
    summary: "Combine any number of sorted linked lists into one.",
    description: [
      "You're given an array of `k` linked lists, `lists`, each sorted in ascending order. Merge them all into one sorted linked list and return its head.",
      "Lists are written as arrays: `[[1, 4], [2]]` means two lists, `1 → 4` and `2`.",
    ],
    constraints: ["`0 <= k <= 10^4`", "Each list has between `0` and `500` nodes.", "`-10^4 <= Node.val <= 10^4`"],
    hint: "Keep a min-heap holding the current head of every list. Repeatedly pop the smallest node, append it, and push its successor. Merging the lists in pairs also works.",
    functionName: { js: "mergeKLists", py: "merge_k_lists" },
    params: [{ name: "lists", type: "list[]" }],
    returns: "list",
    tests: [
      {
        args: [
          [
            [1, 4, 5],
            [1, 3, 4],
            [2, 6],
          ],
        ],
        expected: [1, 1, 2, 3, 4, 4, 5, 6],
        example: true,
      },
      { args: [[]], expected: [], example: true },
      { args: [[[]]], expected: [], example: true },
      { args: [[[2], [1]]], expected: [1, 2] },
      { args: [[[1, 2, 3], [], [0, 10]]], expected: [0, 1, 2, 3, 10] },
      { args: [[[-5, 0, 5], [-6, 6], [-7, 7], [1]]], expected: [-7, -6, -5, 0, 1, 5, 6, 7] },
    ],
  },
  {
    slug: "binary-tree-maximum-path-sum",
    title: "Binary Tree Maximum Path Sum",
    difficulty: "Hard",
    topics: ["Trees", "Dynamic programming"],
    summary: "Find the path through a tree whose values add up to the most.",
    description: [
      "A path in a binary tree is a sequence of nodes where each pair of neighbours is joined by an edge. A node appears at most once in a path, and the path doesn't have to pass through the root.",
      "Given the `root` of a binary tree, return the largest sum of node values over any non-empty path.",
    ],
    constraints: ["The tree has between `1` and `3 * 10^4` nodes.", "`-1000 <= Node.val <= 1000`"],
    hint: "For each node, compute the best downward path starting there (dropping negative branches). The best path that bends at this node is its value plus the best left and right downward paths.",
    functionName: { js: "maxPathSum", py: "max_path_sum" },
    params: [{ name: "root", type: "tree" }],
    returns: "int",
    tests: [
      { args: [[1, 2, 3]], expected: 6, example: true, explanation: "The path 2 → 1 → 3 adds up to 6." },
      {
        args: [[-10, 9, 20, null, null, 15, 7]],
        expected: 42,
        example: true,
        explanation: "The path 15 → 20 → 7 adds up to 42.",
      },
      { args: [[-3]], expected: -3 },
      { args: [[2, -1]], expected: 2 },
      { args: [[-2, 1]], expected: 1 },
      { args: [[5, 4, 8, 11, null, 13, 4, 7, 2, null, null, null, 1]], expected: 48 },
    ],
  },
  {
    slug: "word-ladder",
    title: "Word Ladder",
    difficulty: "Hard",
    topics: ["Graphs", "Strings", "Queue"],
    summary: "Find the shortest chain of one-letter changes between two words.",
    description: [
      "A transformation sequence from `beginWord` to `endWord` changes one letter at a time, and every word after `beginWord` must appear in `wordList`.",
      "Return the number of words in the shortest such sequence, counting both `beginWord` and `endWord`, or `0` if no sequence exists.",
    ],
    constraints: [
      "`1 <= beginWord.length <= 10`",
      "All words have the same length and contain only lowercase English letters.",
      "`1 <= wordList.length <= 5000`",
      "`beginWord` and `endWord` are different.",
    ],
    hint: "Treat each word as a node connected to the words that differ from it by one letter. A breadth-first search from `beginWord` finds the shortest path.",
    functionName: { js: "ladderLength", py: "ladder_length" },
    params: [
      { name: "beginWord", type: "str" },
      { name: "endWord", type: "str" },
      { name: "wordList", type: "str[]" },
    ],
    returns: "int",
    tests: [
      {
        args: ["hit", "cog", ["hot", "dot", "dog", "lot", "log", "cog"]],
        expected: 5,
        example: true,
        explanation: "hit → hot → dot → dog → cog.",
      },
      {
        args: ["hit", "cog", ["hot", "dot", "dog", "lot", "log"]],
        expected: 0,
        example: true,
        explanation: "\"cog\" isn't in the word list, so it can't be reached.",
      },
      { args: ["a", "c", ["a", "b", "c"]], expected: 2 },
      { args: ["red", "tax", ["ted", "tex", "red", "tax", "tad", "den", "rex", "pee"]], expected: 4 },
      { args: ["cold", "warm", ["cord", "card", "ward", "warm", "wold", "word", "worm", "wore", "wire"]], expected: 5 },
    ],
  },
  {
    slug: "n-queens",
    title: "N-Queens",
    difficulty: "Hard",
    topics: ["Backtracking"],
    summary: "Count the ways to place n queens so that none attack each other.",
    description: [
      "Place `n` queens on an `n × n` chessboard so that no two queens attack each other: no two may share a row, a column or a diagonal.",
      "Given `n`, return the number of distinct ways to do it.",
    ],
    constraints: ["`1 <= n <= 9`"],
    hint: "Place one queen per row with backtracking. Track which columns and which diagonals (`row - col` and `row + col`) are taken, so every check takes constant time.",
    functionName: { js: "totalNQueens", py: "total_n_queens" },
    params: [{ name: "n", type: "int" }],
    returns: "int",
    tests: [
      { args: [4], expected: 2, example: true },
      { args: [1], expected: 1, example: true },
      { args: [2], expected: 0 },
      { args: [3], expected: 0 },
      { args: [5], expected: 10 },
      { args: [6], expected: 4 },
      { args: [8], expected: 92 },
    ],
  },
  {
    slug: "edit-distance",
    title: "Edit Distance",
    difficulty: "Hard",
    topics: ["Strings", "Dynamic programming"],
    summary: "Count the fewest edits that turn one word into another.",
    description: [
      "Given two strings `word1` and `word2`, return the minimum number of operations needed to turn `word1` into `word2`.",
      "Each operation inserts one character, deletes one character, or replaces one character.",
    ],
    constraints: ["`0 <= word1.length, word2.length <= 500`", "Both words contain only lowercase English letters."],
    hint: "Let `d[i][j]` be the distance between the first `i` letters of `word1` and the first `j` letters of `word2`. Each cell depends only on its left, upper and upper-left neighbours.",
    functionName: { js: "minDistance", py: "min_distance" },
    params: [
      { name: "word1", type: "str" },
      { name: "word2", type: "str" },
    ],
    returns: "int",
    tests: [
      {
        args: ["horse", "ros"],
        expected: 3,
        example: true,
        explanation: "horse → rorse (replace h) → rose (delete r) → ros (delete e).",
      },
      { args: ["intention", "execution"], expected: 5, example: true },
      { args: ["", "abc"], expected: 3 },
      { args: ["abc", "abc"], expected: 0 },
      { args: ["kitten", "sitting"], expected: 3 },
      { args: ["a", ""], expected: 1 },
      { args: ["sunday", "saturday"], expected: 3 },
    ],
  },
  {
    slug: "regular-expression-matching",
    title: "Regular Expression Matching",
    difficulty: "Hard",
    topics: ["Strings", "Dynamic programming"],
    summary: "Match a string against a pattern with . and * wildcards.",
    description: [
      "Implement pattern matching with two special characters: `.` matches any single character, and `*` matches zero or more copies of the element right before it.",
      "The match must cover the **entire** string `s`, not just part of it. Return `true` if `s` matches the pattern `p`.",
    ],
    constraints: [
      "`1 <= s.length, p.length <= 20`",
      "`s` contains only lowercase letters; `p` contains lowercase letters, `.` and `*`.",
      "Every `*` has a letter or `.` right before it.",
    ],
    hint: "Let `dp[i][j]` mean the first `i` characters of `s` match the first `j` characters of `p`. A `*` either matches zero copies (skip the pair) or one more copy, if its element matches the current character.",
    functionName: { js: "isMatch", py: "is_match" },
    params: [
      { name: "s", type: "str" },
      { name: "p", type: "str" },
    ],
    returns: "bool",
    tests: [
      {
        args: ["aa", "a"],
        expected: false,
        example: true,
        explanation: "\"a\" matches only one character, not the whole string.",
      },
      { args: ["aa", "a*"], expected: true, example: true },
      { args: ["ab", ".*"], expected: true, example: true, explanation: "\".*\" matches any sequence of characters." },
      { args: ["aab", "c*a*b"], expected: true },
      { args: ["mississippi", "mis*is*p*."], expected: false },
      { args: ["abc", "a.c"], expected: true },
      { args: ["abcd", "d*"], expected: false },
      { args: ["aaa", "a*a"], expected: true },
    ],
  },
];

export const TOPICS: string[] = Array.from(new Set(PROBLEMS.flatMap((p) => p.topics))).sort();

export function getProblem(slug: string): Problem | null {
  return PROBLEMS.find((p) => p.slug === slug) ?? null;
}

export function getAdjacentProblems(slug: string): { previous: Problem | null; next: Problem | null } {
  const index = PROBLEMS.findIndex((p) => p.slug === slug);
  return {
    previous: index > 0 ? PROBLEMS[index - 1] : null,
    next: index >= 0 && index < PROBLEMS.length - 1 ? PROBLEMS[index + 1] : null,
  };
}

export function functionNameFor(problem: Problem, language: string): string {
  return language === "python" ? problem.functionName.py : problem.functionName.js;
}

export function exampleTests(problem: Problem): ProblemTest[] {
  return problem.tests.filter((t) => t.example);
}

// "nums = [2, 7, 11, 15], target = 9"
export function formatArgs(problem: Problem, args: unknown[]): string {
  return problem.params.map((param, i) => `${param.name} = ${formatValue(args[i])}`).join(", ");
}

// ---------- Starter code ----------

function tsType(type: ValueType | "void"): string {
  switch (type) {
    case "int":
    case "float":
      return "number";
    case "int[]":
      return "number[]";
    case "int[][]":
      return "number[][]";
    case "str":
      return "string";
    case "str[]":
      return "string[]";
    case "str[][]":
      return "string[][]";
    case "bool":
      return "boolean";
    case "list":
      return "ListNode | null";
    case "list[]":
      return "Array<ListNode | null>";
    case "tree":
      return "TreeNode | null";
    case "void":
      return "void";
  }
}

function pyType(type: ValueType | "void"): string {
  switch (type) {
    case "int":
      return "int";
    case "float":
      return "float";
    case "int[]":
      return "list[int]";
    case "int[][]":
      return "list[list[int]]";
    case "str":
      return "str";
    case "str[]":
      return "list[str]";
    case "str[][]":
      return "list[list[str]]";
    case "bool":
      return "bool";
    case "list":
      return "ListNode | None";
    case "list[]":
      return "list[ListNode | None]";
    case "tree":
      return "TreeNode | None";
    case "void":
      return "None";
  }
}

// A harmless placeholder return value, so the starter code runs (and the
// tests report "wrong answer" rather than crashing).
function placeholder(type: ValueType, language: "js" | "py"): string {
  if (type === "list" || type === "tree") return language === "py" ? "None" : "null";
  if (type.endsWith("[]")) return "[]";
  if (type === "str") return '""';
  if (type === "bool") return language === "py" ? "False" : "false";
  if (type === "float") return language === "py" ? "0.0" : "0";
  return "0";
}

const NODE_CLASSES: Record<"javascript" | "typescript" | "python", { list: string; tree: string }> = {
  javascript: {
    list: [
      "// A linked list node. The tests build their lists from this class.",
      "class ListNode {",
      "  constructor(val = 0, next = null) {",
      "    this.val = val;",
      "    this.next = next;",
      "  }",
      "}",
    ].join("\n"),
    tree: [
      "// A binary tree node. The tests build their trees from this class.",
      "class TreeNode {",
      "  constructor(val = 0, left = null, right = null) {",
      "    this.val = val;",
      "    this.left = left;",
      "    this.right = right;",
      "  }",
      "}",
    ].join("\n"),
  },
  typescript: {
    list: [
      "// A linked list node. The tests build their lists from this class.",
      "class ListNode {",
      "  val: number;",
      "  next: ListNode | null;",
      "  constructor(val = 0, next: ListNode | null = null) {",
      "    this.val = val;",
      "    this.next = next;",
      "  }",
      "}",
    ].join("\n"),
    tree: [
      "// A binary tree node. The tests build their trees from this class.",
      "class TreeNode {",
      "  val: number;",
      "  left: TreeNode | null;",
      "  right: TreeNode | null;",
      "  constructor(val = 0, left: TreeNode | null = null, right: TreeNode | null = null) {",
      "    this.val = val;",
      "    this.left = left;",
      "    this.right = right;",
      "  }",
      "}",
    ].join("\n"),
  },
  python: {
    list: [
      "# A linked list node. The tests build their lists from this class.",
      "class ListNode:",
      "    def __init__(self, val=0, next=None):",
      "        self.val = val",
      "        self.next = next",
    ].join("\n"),
    tree: [
      "# A binary tree node. The tests build their trees from this class.",
      "class TreeNode:",
      "    def __init__(self, val=0, left=None, right=None):",
      "        self.val = val",
      "        self.left = left",
      "        self.right = right",
    ].join("\n"),
  },
};

// The node class definitions a problem's starter code needs, if any.
function nodeClasses(problem: Problem, language: "javascript" | "typescript" | "python"): string {
  const types: string[] = [...problem.params.map((p) => p.type), problem.returns];
  const blocks: string[] = [];
  if (types.includes("list") || types.includes("list[]")) blocks.push(NODE_CLASSES[language].list);
  if (types.includes("tree")) blocks.push(NODE_CLASSES[language].tree);
  if (blocks.length === 0) return "";
  const gap = language === "python" ? "\n\n\n" : "\n\n";
  return blocks.join(gap) + gap;
}

export function getProblemStarterCode(problem: Problem, language: string): string | null {
  const header = `${problem.title}: the full problem is in the Problem tab.`;
  const inPlace = problem.returns === "void";

  if (language === "javascript") {
    const doc = [
      "/**",
      ...problem.params.map((p) => ` * @param {${tsType(p.type)}} ${p.name}`),
      ` * @return {${tsType(problem.returns)}}`,
      " */",
    ].join("\n");
    const params = problem.params.map((p) => p.name).join(", ");
    const body =
      problem.returns === "void"
        ? "  // Change the input in place. There's no need to return anything.\n"
        : `  // Write your solution here.\n  return ${placeholder(problem.returns, "js")};\n`;
    return `// ${header}\n\n${nodeClasses(problem, "javascript")}${doc}\nfunction ${problem.functionName.js}(${params}) {\n${body}}\n`;
  }

  if (language === "typescript") {
    const params = problem.params.map((p) => `${p.name}: ${tsType(p.type)}`).join(", ");
    const body =
      problem.returns === "void"
        ? "  // Change the input in place. There's no need to return anything.\n"
        : `  // Write your solution here.\n  return ${placeholder(problem.returns, "js")};\n`;
    return `// ${header}\n\n${nodeClasses(problem, "typescript")}function ${problem.functionName.js}(${params}): ${tsType(problem.returns)} {\n${body}}\n`;
  }

  if (language === "python") {
    const params = problem.params.map((p) => `${p.name}: ${pyType(p.type)}`).join(", ");
    const body = inPlace
      ? "    # Change the input in place. There's no need to return anything.\n    pass\n"
      : `    # Write your solution here.\n    return ${placeholder(problem.returns as ValueType, "py")}\n`;
    return `# ${header}\n\n${nodeClasses(problem, "python")}def ${problem.functionName.py}(${params}) -> ${pyType(problem.returns)}:\n${body}`;
  }

  return null;
}