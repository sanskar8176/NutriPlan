import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Only allows same-origin, path-style redirect targets ("/dashboard?x=1").
 * Blocks protocol-relative ("//evil.com"), absolute ("https://evil.com") and
 * backslash tricks ("/\evil.com") so callbackUrl can never become an open redirect.
 */
export function isSafeRedirectPath(target: unknown): target is string {
  if (typeof target !== "string" || target.length === 0 || target.length > 2048) return false;
  if (!target.startsWith("/")) return false;
  if (target.startsWith("//") || target.startsWith("/\\")) return false;
  if (/[\u0000-\u001f\u007f]/.test(target)) return false;
  return true;
}

export function safeRedirectPath(target: unknown, fallback = "/dashboard"): string {
  return isSafeRedirectPath(target) ? target : fallback;
}
