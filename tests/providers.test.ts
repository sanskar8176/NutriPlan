import { describe, it, expect } from "vitest";
import { configuredProviders } from "@/lib/meal-plan-service";

const dev = {
  LOCAL_MODEL_BASE_URL: "http://localhost:11434/v1",
  LOCAL_MODEL_NAME: "llama3.2",
  GEMINI_API_KEY: "key",
  GEMINI_MODEL: "gemini-2.5-flash",
} as NodeJS.ProcessEnv;

describe("configuredProviders", () => {
  it("local development: local model first, then Gemini", () => {
    expect(configuredProviders(dev).map((p) => p.provider)).toEqual(["local", "gemini"]);
  });

  it("Vercel: Gemini only, even if local-model variables are set", () => {
    expect(configuredProviders({ ...dev, VERCEL: "1" }).map((p) => p.provider)).toEqual(["gemini"]);
  });

  it("no local model configured: Gemini only", () => {
    expect(configuredProviders({ ...dev, LOCAL_MODEL_NAME: "" }).map((p) => p.provider)).toEqual(["gemini"]);
  });

  it("nothing configured: no AI providers (database/static fallbacks only)", () => {
    expect(configuredProviders({} as NodeJS.ProcessEnv)).toEqual([]);
  });

  it("uses the configured Gemini model name", () => {
    expect(configuredProviders({ ...dev, VERCEL: "1" })[0].geminiModel).toBe("gemini-2.5-flash");
  });
});
