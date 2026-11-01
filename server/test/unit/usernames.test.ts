import { describe, expect, it } from "vitest";
import { USERNAME_PATTERN, isAllowedUsername } from "../../src/lib/usernames";

describe("usernames", () => {
  it("lets ordinary names through, including ones that contain blocked words", () => {
    const fine = [
      "daksh", "alice_99", "bob", "class_act", "assistant", "peacock", "dickens", "analyst",
      "therapist", "torpedo", "laudable", "nigeria_dev", "grapefruit", "sussex_fan", "cumin",
      "badminton", "hello_world", "dev2026", "maya", "leo_codes",
    ];
    for (const name of fine) {
      expect(USERNAME_PATTERN.test(name), name).toBe(true);
      expect(isAllowedUsername(name), name).toBe(true);
    }
  });

  it("blocks slurs and profanity, including simple disguises", () => {
    const blocked = ["fuck", "f_u_c_k", "fuuuck", "sh1t", "b1tch_99", "xx_shit_xx", "nigga", "madarchod", "chutiya_1", "s3x", "a55", "dick", "anal", "randi", "gandu123"];
    for (const name of blocked) expect(isAllowedUsername(name), name).toBe(false);
  });

  it("blocks names that pass for the site or its staff", () => {
    for (const name of ["admin", "admin_2", "moderator", "support", "codeshare", "codeshare_team", "anonymous", "official"]) {
      expect(isAllowedUsername(name), name).toBe(false);
    }
  });
});
