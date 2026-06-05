import { describe, expect, it } from "vitest";
import {
  MAX_POINTS,
  QUESTION_TIME_LIMIT,
  calculateKahootPoints,
  getResponseTime,
} from "@/utils/scoring";

describe("calculateKahootPoints", () => {
  it("returns 0 for incorrect answers", () => {
    expect(calculateKahootPoints(false, 0.1)).toBe(0);
    expect(calculateKahootPoints(false, 12)).toBe(0);
  });

  it("awards max points under 0.5 seconds", () => {
    expect(calculateKahootPoints(true, 0.49)).toBe(MAX_POINTS);
  });

  it("uses formula at exactly 0.5 seconds", () => {
    const points = calculateKahootPoints(true, 0.5, 20);
    expect(points).toBe(988);
  });

  it("clamps response times above timer duration", () => {
    const points = calculateKahootPoints(true, 25, QUESTION_TIME_LIMIT);
    expect(points).toBe(500);
  });

  it("never returns negative points", () => {
    const points = calculateKahootPoints(true, Number.MAX_SAFE_INTEGER, 20);
    expect(points).toBeGreaterThanOrEqual(0);
  });
});

describe("getResponseTime", () => {
  it("computes response time in seconds", () => {
    expect(getResponseTime(1000, 3500)).toBe(2.5);
  });

  it("clamps negative values to 0", () => {
    expect(getResponseTime(5000, 4500)).toBe(0);
  });
});
