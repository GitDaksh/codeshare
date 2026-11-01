import { describe, expect, it } from "vitest";
import { INVITE_CODE, newInviteCode } from "../../src/lib/inviteCode";

describe("invite codes", () => {
  it("are 16 characters from A-Z, a-z and 0-9", () => {
    for (let i = 0; i < 200; i++) expect(newInviteCode()).toMatch(INVITE_CODE);
  });

  it("don't repeat", () => {
    const codes = new Set(Array.from({ length: 2000 }, () => newInviteCode()));
    expect(codes.size).toBe(2000);
  });

  it("use every character about equally (no modulo bias)", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i++) {
      for (const ch of newInviteCode()) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
    // 64,000 characters over 62 symbols: about 1,032 each.
    expect(counts.size).toBe(62);
    for (const [ch, n] of counts) {
      expect(n, ch).toBeGreaterThan(850);
      expect(n, ch).toBeLessThan(1220);
    }
  });
});
