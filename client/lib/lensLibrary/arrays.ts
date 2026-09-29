import type { LensConcept } from "./index";

// Arrays & pointers, searching and hashing.

export const ARRAY_CONCEPTS: LensConcept[] = [
  {
    id: "two-pointers",
    title: "Two pointers",
    category: "arrays",
    summary: "Find two numbers in a sorted array that add up to a target by moving two pointers inward.",
    complexity: "O(n)",
    code: {
      python: `def pair_with_sum(nums, target):
    left, right = 0, len(nums) - 1
    while left < right:
        total = nums[left] + nums[right]
        if total == target:
            return [left, right]
        if total < target:
            left += 1
        else:
            right -= 1
    return []


print(pair_with_sum([1, 3, 4, 6, 8, 11], 10))
`,
      javascript: `function pairWithSum(nums, target) {
  let left = 0;
  let right = nums.length - 1;
  while (left < right) {
    const total = nums[left] + nums[right];
    if (total === target) {
      return [left, right];
    }
    if (total < target) {
      left++;
    } else {
      right--;
    }
  }
  return [];
}

console.log(pairWithSum([1, 3, 4, 6, 8, 11], 10));
`,
      typescript: `function pairWithSum(nums: number[], target: number): number[] {
  let left = 0;
  let right = nums.length - 1;
  while (left < right) {
    const total = nums[left] + nums[right];
    if (total === target) {
      return [left, right];
    }
    if (total < target) {
      left++;
    } else {
      right--;
    }
  }
  return [];
}

console.log(pairWithSum([1, 3, 4, 6, 8, 11], 10));
`,
    },
  },
  {
    id: "reverse-array",
    title: "Reverse in place",
    category: "arrays",
    summary: "Swap from both ends toward the middle, without a second array.",
    complexity: "O(n)",
    code: {
      python: `def reverse(nums):
    left, right = 0, len(nums) - 1
    while left < right:
        nums[left], nums[right] = nums[right], nums[left]
        left += 1
        right -= 1
    return nums


print(reverse([1, 2, 3, 4, 5, 6]))
`,
      javascript: `function reverse(nums) {
  let left = 0;
  let right = nums.length - 1;
  while (left < right) {
    [nums[left], nums[right]] = [nums[right], nums[left]];
    left++;
    right--;
  }
  return nums;
}

console.log(reverse([1, 2, 3, 4, 5, 6]));
`,
      typescript: `function reverse(nums: number[]): number[] {
  let left = 0;
  let right = nums.length - 1;
  while (left < right) {
    [nums[left], nums[right]] = [nums[right], nums[left]];
    left++;
    right--;
  }
  return nums;
}

console.log(reverse([1, 2, 3, 4, 5, 6]));
`,
    },
  },
  {
    id: "move-zeroes",
    title: "Move zeroes",
    category: "arrays",
    summary: "A read pointer scans ahead while a write pointer packs the non-zero numbers to the front.",
    complexity: "O(n)",
    code: {
      python: `def move_zeroes(nums):
    write = 0
    for read in range(len(nums)):
        if nums[read] != 0:
            nums[write], nums[read] = nums[read], nums[write]
            write += 1
    return nums


print(move_zeroes([0, 1, 0, 3, 12, 0, 5]))
`,
      javascript: `function moveZeroes(nums) {
  let write = 0;
  for (let read = 0; read < nums.length; read++) {
    if (nums[read] !== 0) {
      [nums[write], nums[read]] = [nums[read], nums[write]];
      write++;
    }
  }
  return nums;
}

console.log(moveZeroes([0, 1, 0, 3, 12, 0, 5]));
`,
      typescript: `function moveZeroes(nums: number[]): number[] {
  let write = 0;
  for (let read = 0; read < nums.length; read++) {
    if (nums[read] !== 0) {
      [nums[write], nums[read]] = [nums[read], nums[write]];
      write++;
    }
  }
  return nums;
}

console.log(moveZeroes([0, 1, 0, 3, 12, 0, 5]));
`,
    },
  },
  {
    id: "max-subarray",
    title: "Maximum subarray (Kadane)",
    category: "arrays",
    summary: "Keep the best sum ending here, and the best sum so far, in a single pass.",
    complexity: "O(n)",
    code: {
      python: `def max_subarray(nums):
    best = current = nums[0]
    for i in range(1, len(nums)):
        current = max(nums[i], current + nums[i])
        best = max(best, current)
    return best


print(max_subarray([-2, 1, -3, 4, -1, 2, 1, -5, 4]))
`,
      javascript: `function maxSubarray(nums) {
  let best = nums[0];
  let current = nums[0];
  for (let i = 1; i < nums.length; i++) {
    current = Math.max(nums[i], current + nums[i]);
    best = Math.max(best, current);
  }
  return best;
}

console.log(maxSubarray([-2, 1, -3, 4, -1, 2, 1, -5, 4]));
`,
      typescript: `function maxSubarray(nums: number[]): number {
  let best = nums[0];
  let current = nums[0];
  for (let i = 1; i < nums.length; i++) {
    current = Math.max(nums[i], current + nums[i]);
    best = Math.max(best, current);
  }
  return best;
}

console.log(maxSubarray([-2, 1, -3, 4, -1, 2, 1, -5, 4]));
`,
    },
  },
  {
    id: "sliding-window",
    title: "Sliding window",
    category: "arrays",
    summary: "Grow the window on the right, shrink it on the left, to find the longest run with a small enough sum.",
    complexity: "O(n)",
    code: {
      python: `def longest_window(nums, limit):
    left = 0
    total = 0
    best = 0
    for right in range(len(nums)):
        total += nums[right]
        while total > limit:
            total -= nums[left]
            left += 1
        best = max(best, right - left + 1)
    return best


print(longest_window([3, 1, 2, 7, 4, 2, 1, 1, 5], 8))
`,
      javascript: `function longestWindow(nums, limit) {
  let left = 0;
  let total = 0;
  let best = 0;
  for (let right = 0; right < nums.length; right++) {
    total += nums[right];
    while (total > limit) {
      total -= nums[left];
      left++;
    }
    best = Math.max(best, right - left + 1);
  }
  return best;
}

console.log(longestWindow([3, 1, 2, 7, 4, 2, 1, 1, 5], 8));
`,
      typescript: `function longestWindow(nums: number[], limit: number): number {
  let left = 0;
  let total = 0;
  let best = 0;
  for (let right = 0; right < nums.length; right++) {
    total += nums[right];
    while (total > limit) {
      total -= nums[left];
      left++;
    }
    best = Math.max(best, right - left + 1);
  }
  return best;
}

console.log(longestWindow([3, 1, 2, 7, 4, 2, 1, 1, 5], 8));
`,
    },
  },
  {
    id: "binary-search",
    title: "Binary search",
    category: "searching",
    summary: "Halve the search window around the middle until the target is found.",
    complexity: "O(log n)",
    code: {
      python: `def binary_search(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1


print(binary_search([2, 5, 8, 12, 16, 23, 38, 56, 72, 91], 23))
`,
      javascript: `function binarySearch(nums, target) {
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
      typescript: `function binarySearch(nums: number[], target: number): number {
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
    },
  },
  {
    id: "search-insert",
    title: "Insert position (lower bound)",
    category: "searching",
    summary: "Binary search for the first spot where the target fits, even when it isn't there.",
    complexity: "O(log n)",
    code: {
      python: `def search_insert(nums, target):
    lo, hi = 0, len(nums)
    while lo < hi:
        mid = (lo + hi) // 2
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid
    return lo


print(search_insert([1, 3, 5, 6, 9, 12], 7))
`,
      javascript: `function searchInsert(nums, target) {
  let lo = 0;
  let hi = nums.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (nums[mid] < target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

console.log(searchInsert([1, 3, 5, 6, 9, 12], 7));
`,
      typescript: `function searchInsert(nums: number[], target: number): number {
  let lo = 0;
  let hi = nums.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (nums[mid] < target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

console.log(searchInsert([1, 3, 5, 6, 9, 12], 7));
`,
    },
  },
  {
    id: "hash-map",
    title: "Counting words",
    category: "hashing",
    summary: "Count every word in a hash map, then pick the most common one.",
    complexity: "O(n)",
    code: {
      python: `text = "the quick brown fox jumps over the lazy dog the end"
counts = {}
for word in text.split():
    counts[word] = counts.get(word, 0) + 1

best = max(counts, key=counts.get)
print(best, counts[best])
`,
      javascript: `const text = "the quick brown fox jumps over the lazy dog the end";
const counts = new Map();
for (const word of text.split(" ")) {
  counts.set(word, (counts.get(word) ?? 0) + 1);
}

let best = "";
for (const [word, count] of counts) {
  if (count > (counts.get(best) ?? 0)) {
    best = word;
  }
}
console.log(best, counts.get(best));
`,
      typescript: `const text = "the quick brown fox jumps over the lazy dog the end";
const counts = new Map<string, number>();
for (const word of text.split(" ")) {
  counts.set(word, (counts.get(word) ?? 0) + 1);
}

let best = "";
for (const [word, count] of counts) {
  if (count > (counts.get(best) ?? 0)) {
    best = word;
  }
}
console.log(best, counts.get(best));
`,
    },
  },
  {
    id: "two-sum-hash",
    title: "Two sum with a hash map",
    category: "hashing",
    summary: "Remember every number you've seen, and look up the one you still need in a single step.",
    complexity: "O(n)",
    code: {
      python: `def two_sum(nums, target):
    seen = {}
    for i in range(len(nums)):
        need = target - nums[i]
        if need in seen:
            return [seen[need], i]
        seen[nums[i]] = i
    return []


print(two_sum([4, 11, 7, 15, 2], 9))
`,
      javascript: `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) {
      return [seen.get(need), i];
    }
    seen.set(nums[i], i);
  }
  return [];
}

console.log(twoSum([4, 11, 7, 15, 2], 9));
`,
      typescript: `function twoSum(nums: number[], target: number): number[] {
  const seen = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) {
      return [seen.get(need)!, i];
    }
    seen.set(nums[i], i);
  }
  return [];
}

console.log(twoSum([4, 11, 7, 15, 2], 9));
`,
    },
  },
  {
    id: "group-anagrams",
    title: "Group anagrams",
    category: "hashing",
    summary: "Words with the same letters share a sorted key, so a hash map gathers them together.",
    complexity: "O(n · k log k)",
    code: {
      python: `def group_anagrams(words):
    groups = {}
    for word in words:
        key = "".join(sorted(word))
        groups.setdefault(key, []).append(word)
    return list(groups.values())


print(group_anagrams(["eat", "tea", "tan", "ate", "nat", "bat"]))
`,
      javascript: `function groupAnagrams(words) {
  const groups = new Map();
  for (const word of words) {
    const key = word.split("").sort().join("");
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(word);
  }
  return [...groups.values()];
}

console.log(groupAnagrams(["eat", "tea", "tan", "ate", "nat", "bat"]));
`,
      typescript: `function groupAnagrams(words: string[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const word of words) {
    const key = word.split("").sort().join("");
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(word);
  }
  return [...groups.values()];
}

console.log(groupAnagrams(["eat", "tea", "tan", "ate", "nat", "bat"]));
`,
    },
  },
];