import { describe, it, expect } from "vitest";
import { API_VERSION } from "./index.js";

describe("@cash/api", () => {
  it("exports API version", () => {
    expect(API_VERSION).toBe("0.1.0");
  });
});
