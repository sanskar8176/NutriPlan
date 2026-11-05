import { describe, it, expect } from "vitest";
import { safeImageUrl, isAllowedImageUrl, imageForCategory, DEFAULT_FOOD_IMAGE } from "@/lib/images";
import { isSafeRedirectPath, safeRedirectPath } from "@/lib/utils";

describe("image allow-list", () => {
  it("accepts https Unsplash URLs", () => {
    expect(isAllowedImageUrl("https://images.unsplash.com/photo-1?w=400")).toBe(true);
    expect(isAllowedImageUrl("https://plus.unsplash.com/premium_photo-1")).toBe(true);
  });
  it("rejects other hosts, http, and garbage", () => {
    expect(isAllowedImageUrl("https://evil.example/x.png")).toBe(false);
    expect(isAllowedImageUrl("http://images.unsplash.com/photo-1")).toBe(false);
    expect(isAllowedImageUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedImageUrl(null)).toBe(false);
  });
  it("falls back to a category image or the default", () => {
    expect(safeImageUrl("https://evil.example/x.png", "dal")).toBe(imageForCategory("dal"));
    expect(safeImageUrl(undefined)).toBe(DEFAULT_FOOD_IMAGE);
    expect(imageForCategory("unknown-category")).toBe(DEFAULT_FOOD_IMAGE);
  });
});

describe("redirect safety", () => {
  it("allows same-origin paths", () => {
    expect(isSafeRedirectPath("/dashboard")).toBe(true);
    expect(isSafeRedirectPath("/results?age=30&goal=lose")).toBe(true);
  });
  it("blocks open-redirect vectors", () => {
    expect(isSafeRedirectPath("https://evil.example")).toBe(false);
    expect(isSafeRedirectPath("//evil.example")).toBe(false);
    expect(isSafeRedirectPath("/\\evil.example")).toBe(false);
    expect(isSafeRedirectPath("javascript:alert(1)")).toBe(false);
    expect(isSafeRedirectPath("")).toBe(false);
    expect(isSafeRedirectPath(null)).toBe(false);
  });
  it("falls back to the default", () => {
    expect(safeRedirectPath("https://evil.example", "/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("/plan", "/dashboard")).toBe("/plan");
  });
});
