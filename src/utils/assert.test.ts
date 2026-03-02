import { describe, expect, it } from "vitest";
import { assert } from "./assert"; // Adjust path as needed

describe("assert utility", () => {
  it("should throw an error when condition is falsy", () => {
    // Testing with false
    expect(() => assert(false)).toThrow("Assertion failed");

    // Testing with custom message
    const customMessage = "Data must be present";
    expect(() => assert(null, customMessage)).toThrow(customMessage);

    // Testing other falsy values
    expect(() => assert(0)).toThrow();
    expect(() => assert("")).toThrow();
    expect(() => assert(undefined)).toThrow();
  });

  it("should not throw when condition is truthy", () => {
    // These should execute without error
    expect(() => assert(true)).not.toThrow();
    expect(() => assert(1)).not.toThrow();
    expect(() => assert("hello")).not.toThrow();
    expect(() => assert({})).not.toThrow();
  });

  it("should narrow types correctly (TypeScript check)", () => {
    const value: string | null = "test" as string | null;

    assert(value !== null);

    // After assert, TypeScript knows 'value' is a string
    // This is a compile-time check, but ensures the 'asserts' keyword works
    expect(value.toUpperCase()).toBe("TEST");
  });
});
