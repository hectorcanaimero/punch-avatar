export type UsernameValidation = {
  valid: boolean;
  reason: string;
};

const USERNAME_RE = /^[a-zA-Z0-9]{3,20}$/;

// WHY: case-insensitive — "Admin" no debe colarse como variante de "admin".
const RESERVED = new Set(["admin", "root", "null", "nakama"]);

export function validateUsername(input: string): UsernameValidation {
  if (input.length < 3) {
    return { valid: false, reason: "too_short" };
  }
  if (input.length > 20) {
    return { valid: false, reason: "too_long" };
  }
  if (!USERNAME_RE.test(input)) {
    return { valid: false, reason: "invalid_chars" };
  }
  if (RESERVED.has(input.toLowerCase())) {
    return { valid: false, reason: "reserved" };
  }
  return { valid: true, reason: "ok" };
}
