import { randomBytes } from "crypto";

// Room invite codes: 16 characters from 62, about 95 bits of randomness, so
// they can't be guessed (unlike database ids, which are a timestamp plus a
// counter).
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const LENGTH = 16;

export const INVITE_CODE = /^[A-Za-z0-9]{16}$/;

export function newInviteCode(): string {
  let code = "";
  while (code.length < LENGTH) {
    for (const byte of randomBytes(32)) {
      // Bytes from 248 up are skipped (248 = 62 × 4), so every character is
      // equally likely.
      if (byte < 248 && code.length < LENGTH) code += ALPHABET[byte % ALPHABET.length];
    }
  }
  return code;
}