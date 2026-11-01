// Usernames are public: they show on leaderboards that anyone can open, on
// profile cards and in rooms. This keeps out the obvious abuse: slurs and
// profanity (including simple disguises like "sh1t" or "f_u_c_k"), and names
// that pretend to be the site itself ("admin", "codeshare_team"). It isn't a
// full moderation system, and it errs on the side of letting ordinary names
// through ("class", "peacock", "therapist", "torpedo" and "laudable" are fine).

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

// Blocked anywhere in a name. Each is long or rare enough not to turn up
// inside everyday words.
const BLOCKED_ANYWHERE = [
  "fuck", "shit", "bitch", "cunt", "whore", "slut", "pussy", "porn", "penis", "vagina",
  "nigger", "nigga", "faggot", "retard", "hitler", "pedophile", "paedophile", "molest",
  "killyourself", "cocksucker", "bastard", "wanker", "twat", "dildo", "jizz",
  // Hindi and Hinglish
  "chutiya", "chutia", "madarchod", "maderchod", "bhenchod", "behenchod", "bhosdi", "bhosda",
  "chodu", "harami", "lavde",
  // Pretending to be the site
  "codeshare",
];

// Blocked only as the whole name, because they turn up inside innocent words
// ("dick" in "dickens", "anal" in "analyst", "rapist" in "therapist").
const BLOCKED_WHOLE = [
  "ass", "arse", "dick", "cock", "anal", "anus", "sex", "rape", "rapist", "pedo", "nazi", "cum",
  "fag", "kys", "tits", "boob", "boobs", "hoe", "thot", "fuk",
  "lund", "loda", "lauda", "lavda", "gandu", "randi", "bsdk", "mc", "bc",
];

// Names that could pass for the site or its staff.
const RESERVED = [
  "admin", "administrator", "moderator", "mod", "staff", "support", "official", "system",
  "root", "owner", "anonymous", "null", "undefined", "help", "security",
];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g" };

// The forms of a name to check: with digits read as letters ("sh1t" → shit)
// and with digits dropped ("admin_2" → admin). Underscores are ignored, and a
// letter repeated three or more times counts once ("fuuuck" → fuck).
function forms(username: string): string[] {
  const base = username.toLowerCase().replace(/_/g, "");
  const leet = base.replace(/[0-9]/g, (c) => LEET[c] ?? "");
  const noDigits = base.replace(/[0-9]/g, "");
  const squeeze = (s: string) => s.replace(/([a-z])\1{2,}/g, "$1");
  return [...new Set([leet, noDigits, squeeze(leet), squeeze(noDigits)])].filter(Boolean);
}

// Whether a username may be used (on top of USERNAME_PATTERN).
export function isAllowedUsername(username: string): boolean {
  for (const form of forms(username)) {
    if (BLOCKED_ANYWHERE.some((word) => form.includes(word))) return false;
    if (BLOCKED_WHOLE.includes(form) || RESERVED.includes(form)) return false;
  }
  return true;
}
