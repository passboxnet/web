/**
 * Remembers whether any account was ever used on this device, so a first
 * visit opens "Create account" and a returning user sees "Sign in".
 */
const KEY = "passbox.usedBefore";

export function wasUsedBefore(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1" || window.localStorage.getItem("passbox.account") !== null;
  } catch {
    return true;
  }
}

export function markUsedBefore() {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // Only affects which tab opens first.
  }
}
