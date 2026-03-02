import { describe, expect, it } from "vitest";
import { isValidBirthDate } from "./birthday.service";

describe("isValidBirthDate", () => {
	describe("month bounds", () => {
		it("rejects month 0", () => {
			expect(isValidBirthDate(1, 0, null)).toBe(false);
		});

		it("rejects month 13", () => {
			expect(isValidBirthDate(1, 13, null)).toBe(false);
		});

		it("accepts month 1 (January)", () => {
			expect(isValidBirthDate(1, 1, null)).toBe(true);
		});

		it("accepts month 12 (December)", () => {
			expect(isValidBirthDate(31, 12, null)).toBe(true);
		});
	});

	describe("day bounds", () => {
		it("rejects day 0", () => {
			expect(isValidBirthDate(0, 6, null)).toBe(false);
		});

		it("rejects day 32 for January", () => {
			expect(isValidBirthDate(32, 1, null)).toBe(false);
		});

		it("rejects day 31 for April (30 days)", () => {
			expect(isValidBirthDate(31, 4, null)).toBe(false);
		});

		it("accepts day 30 for April", () => {
			expect(isValidBirthDate(30, 4, null)).toBe(true);
		});
	});

	describe("February edge cases", () => {
		it("rejects Feb 29 on a non-leap year", () => {
			expect(isValidBirthDate(29, 2, 2001)).toBe(false);
		});

		it("accepts Feb 29 on a leap year", () => {
			expect(isValidBirthDate(29, 2, 2000)).toBe(true);
		});

		it("rejects Feb 30 regardless of year", () => {
			expect(isValidBirthDate(30, 2, null)).toBe(false);
			expect(isValidBirthDate(30, 2, 2000)).toBe(false);
		});

		it("accepts Feb 28 without year (uses 2000 as ref, a leap year)", () => {
			expect(isValidBirthDate(28, 2, null)).toBe(true);
		});

		it("accepts Feb 29 without year (2000 is a leap year reference)", () => {
			expect(isValidBirthDate(29, 2, null)).toBe(true);
		});
	});

	describe("year bounds", () => {
		it("rejects year 1899", () => {
			expect(isValidBirthDate(1, 1, 1899)).toBe(false);
		});

		it("accepts year 1900", () => {
			expect(isValidBirthDate(1, 1, 1900)).toBe(true);
		});

		it("rejects future year", () => {
			const nextYear = new Date().getFullYear() + 1;
			expect(isValidBirthDate(1, 1, nextYear)).toBe(false);
		});

		it("accepts current year", () => {
			const currentYear = new Date().getFullYear();
			expect(isValidBirthDate(1, 1, currentYear)).toBe(true);
		});

		it("accepts null year (no birth year known)", () => {
			expect(isValidBirthDate(15, 6, null)).toBe(true);
		});
	});

	describe("valid typical dates", () => {
		it("accepts 25 December", () => {
			expect(isValidBirthDate(25, 12, null)).toBe(true);
		});

		it("accepts 1 January 1990", () => {
			expect(isValidBirthDate(1, 1, 1990)).toBe(true);
		});

		it("accepts 31 January", () => {
			expect(isValidBirthDate(31, 1, null)).toBe(true);
		});

		it("rejects 31 November (30-day month)", () => {
			expect(isValidBirthDate(31, 11, null)).toBe(false);
		});
	});
});
