import type { LensConcept } from "./index";

// Sorting.

export const SORTING_CONCEPTS: LensConcept[] = [
  {
    id: "bubble-sort",
    title: "Bubble sort",
    category: "sorting",
    summary: "Swap neighbours that are out of order; each pass bubbles the largest value to the end.",
    complexity: "O(n²)",
    code: {
      python: `def bubble_sort(nums):
    n = len(nums)
    for i in range(n):
        for j in range(n - 1 - i):
            if nums[j] > nums[j + 1]:
                nums[j], nums[j + 1] = nums[j + 1], nums[j]
    return nums


print(bubble_sort([5, 1, 4, 2, 8, 3]))
`,
      javascript: `function bubbleSort(nums) {
  const n = nums.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n - 1 - i; j++) {
      if (nums[j] > nums[j + 1]) {
        [nums[j], nums[j + 1]] = [nums[j + 1], nums[j]];
      }
    }
  }
  return nums;
}

console.log(bubbleSort([5, 1, 4, 2, 8, 3]));
`,
      typescript: `function bubbleSort(nums: number[]): number[] {
  const n = nums.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n - 1 - i; j++) {
      if (nums[j] > nums[j + 1]) {
        [nums[j], nums[j + 1]] = [nums[j + 1], nums[j]];
      }
    }
  }
  return nums;
}

console.log(bubbleSort([5, 1, 4, 2, 8, 3]));
`,
    },
  },
  {
    id: "selection-sort",
    title: "Selection sort",
    category: "sorting",
    summary: "Find the smallest value in the unsorted part and swap it to the front.",
    complexity: "O(n²)",
    code: {
      python: `def selection_sort(nums):
    for i in range(len(nums)):
        smallest = i
        for j in range(i + 1, len(nums)):
            if nums[j] < nums[smallest]:
                smallest = j
        nums[i], nums[smallest] = nums[smallest], nums[i]
    return nums


print(selection_sort([29, 10, 14, 37, 13, 5]))
`,
      javascript: `function selectionSort(nums) {
  for (let i = 0; i < nums.length; i++) {
    let smallest = i;
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[j] < nums[smallest]) {
        smallest = j;
      }
    }
    [nums[i], nums[smallest]] = [nums[smallest], nums[i]];
  }
  return nums;
}

console.log(selectionSort([29, 10, 14, 37, 13, 5]));
`,
      typescript: `function selectionSort(nums: number[]): number[] {
  for (let i = 0; i < nums.length; i++) {
    let smallest = i;
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[j] < nums[smallest]) {
        smallest = j;
      }
    }
    [nums[i], nums[smallest]] = [nums[smallest], nums[i]];
  }
  return nums;
}

console.log(selectionSort([29, 10, 14, 37, 13, 5]));
`,
    },
  },
  {
    id: "insertion-sort",
    title: "Insertion sort",
    category: "sorting",
    summary: "Take the next value and shift bigger ones right until it drops into place.",
    complexity: "O(n²)",
    code: {
      python: `def insertion_sort(nums):
    for i in range(1, len(nums)):
        current = nums[i]
        j = i - 1
        while j >= 0 and nums[j] > current:
            nums[j + 1] = nums[j]
            j -= 1
        nums[j + 1] = current
    return nums


print(insertion_sort([12, 11, 13, 5, 6, 7]))
`,
      javascript: `function insertionSort(nums) {
  for (let i = 1; i < nums.length; i++) {
    const current = nums[i];
    let j = i - 1;
    while (j >= 0 && nums[j] > current) {
      nums[j + 1] = nums[j];
      j--;
    }
    nums[j + 1] = current;
  }
  return nums;
}

console.log(insertionSort([12, 11, 13, 5, 6, 7]));
`,
      typescript: `function insertionSort(nums: number[]): number[] {
  for (let i = 1; i < nums.length; i++) {
    const current = nums[i];
    let j = i - 1;
    while (j >= 0 && nums[j] > current) {
      nums[j + 1] = nums[j];
      j--;
    }
    nums[j + 1] = current;
  }
  return nums;
}

console.log(insertionSort([12, 11, 13, 5, 6, 7]));
`,
    },
  },
  {
    id: "merge-sort",
    title: "Merge sort",
    category: "sorting",
    summary: "Split in half, sort each half recursively, then merge two sorted lists with two pointers.",
    complexity: "O(n log n)",
    code: {
      python: `def merge_sort(nums):
    if len(nums) <= 1:
        return nums
    mid = len(nums) // 2
    left = merge_sort(nums[:mid])
    right = merge_sort(nums[mid:])
    return merge(left, right)


def merge(left, right):
    merged = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            merged.append(left[i])
            i += 1
        else:
            merged.append(right[j])
            j += 1
    merged.extend(left[i:])
    merged.extend(right[j:])
    return merged


print(merge_sort([38, 27, 43, 3, 9, 82, 10]))
`,
      javascript: `function mergeSort(nums) {
  if (nums.length <= 1) {
    return nums;
  }
  const mid = Math.floor(nums.length / 2);
  const left = mergeSort(nums.slice(0, mid));
  const right = mergeSort(nums.slice(mid));
  return merge(left, right);
}

function merge(left, right) {
  const merged = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) {
      merged.push(left[i]);
      i++;
    } else {
      merged.push(right[j]);
      j++;
    }
  }
  return merged.concat(left.slice(i), right.slice(j));
}

console.log(mergeSort([38, 27, 43, 3, 9, 82, 10]));
`,
      typescript: `function mergeSort(nums: number[]): number[] {
  if (nums.length <= 1) {
    return nums;
  }
  const mid = Math.floor(nums.length / 2);
  const left = mergeSort(nums.slice(0, mid));
  const right = mergeSort(nums.slice(mid));
  return merge(left, right);
}

function merge(left: number[], right: number[]): number[] {
  const merged: number[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) {
      merged.push(left[i]);
      i++;
    } else {
      merged.push(right[j]);
      j++;
    }
  }
  return merged.concat(left.slice(i), right.slice(j));
}

console.log(mergeSort([38, 27, 43, 3, 9, 82, 10]));
`,
    },
  },
  {
    id: "quick-sort",
    title: "Quick sort",
    category: "sorting",
    summary: "Partition around a pivot so smaller values go left, then sort each side recursively.",
    complexity: "O(n log n) average",
    code: {
      python: `def quick_sort(nums, lo, hi):
    if lo < hi:
        p = partition(nums, lo, hi)
        quick_sort(nums, lo, p - 1)
        quick_sort(nums, p + 1, hi)
    return nums


def partition(nums, lo, hi):
    pivot = nums[hi]
    i = lo
    for j in range(lo, hi):
        if nums[j] < pivot:
            nums[i], nums[j] = nums[j], nums[i]
            i += 1
    nums[i], nums[hi] = nums[hi], nums[i]
    return i


nums = [10, 80, 30, 90, 40, 50, 70]
print(quick_sort(nums, 0, len(nums) - 1))
`,
      javascript: `function quickSort(nums, lo, hi) {
  if (lo < hi) {
    const p = partition(nums, lo, hi);
    quickSort(nums, lo, p - 1);
    quickSort(nums, p + 1, hi);
  }
  return nums;
}

function partition(nums, lo, hi) {
  const pivot = nums[hi];
  let i = lo;
  for (let j = lo; j < hi; j++) {
    if (nums[j] < pivot) {
      [nums[i], nums[j]] = [nums[j], nums[i]];
      i++;
    }
  }
  [nums[i], nums[hi]] = [nums[hi], nums[i]];
  return i;
}

const nums = [10, 80, 30, 90, 40, 50, 70];
console.log(quickSort(nums, 0, nums.length - 1));
`,
      typescript: `function quickSort(nums: number[], lo: number, hi: number): number[] {
  if (lo < hi) {
    const p = partition(nums, lo, hi);
    quickSort(nums, lo, p - 1);
    quickSort(nums, p + 1, hi);
  }
  return nums;
}

function partition(nums: number[], lo: number, hi: number): number {
  const pivot = nums[hi];
  let i = lo;
  for (let j = lo; j < hi; j++) {
    if (nums[j] < pivot) {
      [nums[i], nums[j]] = [nums[j], nums[i]];
      i++;
    }
  }
  [nums[i], nums[hi]] = [nums[hi], nums[i]];
  return i;
}

const nums: number[] = [10, 80, 30, 90, 40, 50, 70];
console.log(quickSort(nums, 0, nums.length - 1));
`,
    },
  },
  {
    id: "counting-sort",
    title: "Counting sort",
    category: "sorting",
    summary: "Count how often each value appears, then write the values back out in order.",
    complexity: "O(n + k)",
    code: {
      python: `def counting_sort(nums):
    counts = [0] * (max(nums) + 1)
    for x in nums:
        counts[x] += 1
    result = []
    for value in range(len(counts)):
        result.extend([value] * counts[value])
    return result


print(counting_sort([4, 2, 2, 8, 3, 3, 1]))
`,
      javascript: `function countingSort(nums) {
  const counts = new Array(Math.max(...nums) + 1).fill(0);
  for (const x of nums) {
    counts[x]++;
  }
  const result = [];
  for (let value = 0; value < counts.length; value++) {
    for (let n = 0; n < counts[value]; n++) {
      result.push(value);
    }
  }
  return result;
}

console.log(countingSort([4, 2, 2, 8, 3, 3, 1]));
`,
      typescript: `function countingSort(nums: number[]): number[] {
  const counts: number[] = new Array(Math.max(...nums) + 1).fill(0);
  for (const x of nums) {
    counts[x]++;
  }
  const result: number[] = [];
  for (let value = 0; value < counts.length; value++) {
    for (let n = 0; n < counts[value]; n++) {
      result.push(value);
    }
  }
  return result;
}

console.log(countingSort([4, 2, 2, 8, 3, 3, 1]));
`,
    },
  },
];