import { describe, expect, it } from "vitest";
import { generateRoomCode } from "@/utils/roomCode";

describe("generateRoomCode", () => {
  it("returns a 6-character code", () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
  });

  it("uses only allowed characters", () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it("produces varied codes", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateRoomCode()));
    expect(codes.size).toBeGreaterThan(180);
  });
});
