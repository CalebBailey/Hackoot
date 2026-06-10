import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUESTION_TIME_LIMIT,
  MAX_POINTS,
  QUESTION_TIME_LIMIT,
  calculateKahootPoints,
  getResponseTime,
  sanitizeQuestionTimeLimit,
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

  it("awards different points for different timer durations", () => {
    const quickTimer = calculateKahootPoints(true, 5, 10);
    const longTimer = calculateKahootPoints(true, 5, 60);
    expect(longTimer).toBeGreaterThan(quickTimer);
  });

  it("supports dynamic timer values", () => {
    expect(calculateKahootPoints(true, 5, 10)).toBe(750);
    expect(calculateKahootPoints(true, 5, 20)).toBe(875);
    expect(calculateKahootPoints(true, 5, 30)).toBe(917);
    expect(calculateKahootPoints(true, 5, 60)).toBe(958);
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

describe("sanitizeQuestionTimeLimit", () => {
  it("falls back to default when missing", () => {
    expect(sanitizeQuestionTimeLimit(undefined)).toBe(DEFAULT_QUESTION_TIME_LIMIT);
  });

  it("normalizes decimals to whole numbers", () => {
    expect(sanitizeQuestionTimeLimit(12.9)).toBe(13);
  });

  it("enforces a positive integer minimum of 1", () => {
    expect(sanitizeQuestionTimeLimit(0)).toBe(1);
    expect(sanitizeQuestionTimeLimit(-5)).toBe(1);
  });

  it("keeps large integers without hard upper clamp", () => {
    expect(sanitizeQuestionTimeLimit(999)).toBe(999);
  });
});
