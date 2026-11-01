import { describe, expect, it } from "vitest";
import { pick, randInt, rng, seedFrom, shuffled } from "@/lib/games/rng";

// Every browser in a match must compute the same game from the same seed,
// so these have to be exactly repeatable.
describe("seeded randomness", () => {
  it("gives the same sequence for the same seed, and a different one for another", () => {
    const a = rng(42);
    const b = rng(42);
    const c = rng(43);
    const first = Array.from({ length: 20 }, () => a());
    expect(Array.from({ length: 20 }, () => b())).toEqual(first);
    expect(Array.from({ length: 20 }, () => c())).not.toEqual(first);
  });

  it("stays between 0 (included) and 1 (excluded)", () => {
    const random = rng(7);
    for (let i = 0; i < 10_000; i++) {
      const value = random();
      expect(value >= 0 && value < 1).toBe(true);
    }
  });

  it("picks whole numbers in the range, both ends included", () => {
    const random = rng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const value = randInt(random, 3, 6);
      expect(Number.isInteger(value) && value >= 3 && value <= 6).toBe(true);
      seen.add(value);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it("shuffles a copy into a repeatable order", () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    const once = shuffled(rng(5), items);
    expect(shuffled(rng(5), items)).toEqual(once);
    expect([...once].sort((x, y) => x - y)).toEqual(items);
    expect(once).not.toEqual(items);
    expect(items[0]).toBe(0); // the original is untouched
  });

  it("picks from the list", () => {
    const random = rng(9);
    for (let i = 0; i < 100; i++) expect(["a", "b", "c"]).toContain(pick(random, ["a", "b", "c"]));
  });

  it("turns text (like today's date) into the same seed every time", () => {
    expect(seedFrom("2026-11-01")).toBe(seedFrom("2026-11-01"));
    expect(seedFrom("2026-11-01")).not.toBe(seedFrom("2026-11-02"));
    expect(Number.isInteger(seedFrom("x")) && seedFrom("x") >= 0).toBe(true);
  });
});
