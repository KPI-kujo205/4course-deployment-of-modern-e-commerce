import { describe, expect, it } from "vitest";
import type { BirthdayEntry } from "@/services/birthday.service";
import {
	formatDate,
	formatDaysUntil,
	formatDetailCard,
	formatEntryLine,
	parseBirthDate,
} from "./birthday-helpers";

describe("formatDaysUntil", () => {
	it("returns 'today!' for 0", () => {
		expect(formatDaysUntil(0)).toBe("today!");
	});

	it("returns 'tomorrow' for 1", () => {
		expect(formatDaysUntil(1)).toBe("tomorrow");
	});

	it("returns 'in N days' for values > 1", () => {
		expect(formatDaysUntil(2)).toBe("in 2 days");
		expect(formatDaysUntil(30)).toBe("in 30 days");
		expect(formatDaysUntil(365)).toBe("in 365 days");
	});
});

// ─── formatDate ───────────────────────────────────────────────────────────────

describe("formatDate", () => {
	it("formats without year", () => {
		expect(formatDate(5, 3, null)).toBe("5 March");
	});

	it("formats with year", () => {
		expect(formatDate(25, 12, 1990)).toBe("25 December 1990");
	});

	it("formats first day of January", () => {
		expect(formatDate(1, 1, null)).toBe("1 January");
	});

	it("formats last day of December", () => {
		expect(formatDate(31, 12, 2000)).toBe("31 December 2000");
	});
});

describe("formatEntryLine", () => {
	const base: BirthdayEntry = {
		id: "abc",
		name: "Alice",
		telegramUsername: null,
		description: null,
		birthDay: 15,
		birthMonth: 6,
		birthYear: null,
		remindOnDay: true,
		remind3DaysBefore: false,
		remind1WeekBefore: false,
		daysUntil: 10,
	};

	it("uses 'Unknown' when name is null", () => {
		expect(formatEntryLine({ ...base, name: null })).toBe(
			"Unknown — 15 Jun (in 10 days)",
		);
	});

	it("shows 'today!' when daysUntil is 0", () => {
		expect(formatEntryLine({ ...base, daysUntil: 0 })).toBe(
			"Alice — 15 Jun (today!)",
		);
	});

	it("shows 'tomorrow' when daysUntil is 1", () => {
		expect(formatEntryLine({ ...base, daysUntil: 1 })).toBe(
			"Alice — 15 Jun (tomorrow)",
		);
	});

	it("uses 3-letter month abbreviation", () => {
		// January → Jan
		expect(formatEntryLine({ ...base, birthMonth: 1 })).toContain("Jan");
		// September → Sep
		expect(formatEntryLine({ ...base, birthMonth: 9 })).toContain("Sep");
	});
});

// ─── formatDetailCard ─────────────────────────────────────────────────────────

describe("formatDetailCard", () => {
	const base: BirthdayEntry = {
		id: "abc",
		name: "Bob",
		telegramUsername: "@bob",
		description: "Best friend",
		birthDay: 20,
		birthMonth: 8,
		birthYear: 1985,
		remindOnDay: true,
		remind3DaysBefore: true,
		remind1WeekBefore: false,
		daysUntil: 5,
	};

	it("includes name", () => {
		expect(formatDetailCard(base)).toContain("Name: Bob");
	});

	it("includes birthday with year", () => {
		expect(formatDetailCard(base)).toContain("Birthday: 20 August 1985");
	});

	it("includes coming-up line", () => {
		expect(formatDetailCard(base)).toContain("Coming up: in 5 days");
	});

	it("includes telegram username", () => {
		expect(formatDetailCard(base)).toContain("Telegram: @bob");
	});

	it("includes description", () => {
		expect(formatDetailCard(base)).toContain("Note: Best friend");
	});

	it("includes active reminders", () => {
		const card = formatDetailCard(base);
		expect(card).toContain("on the day");
		expect(card).toContain("3 days before");
		expect(card).not.toContain("1 week before");
	});

	it("omits telegram line when null", () => {
		expect(formatDetailCard({ ...base, telegramUsername: null })).not.toContain(
			"Telegram:",
		);
	});

	it("omits note line when null", () => {
		expect(formatDetailCard({ ...base, description: null })).not.toContain(
			"Note:",
		);
	});

	it("shows 'none' when all reminders are off", () => {
		const card = formatDetailCard({
			...base,
			remindOnDay: false,
			remind3DaysBefore: false,
			remind1WeekBefore: false,
		});
		expect(card).toContain("Reminders: none");
	});

	it("shows birthday without year when birthYear is null", () => {
		expect(formatDetailCard({ ...base, birthYear: null })).toContain(
			"Birthday: 20 August",
		);
	});

	it("uses '—' for null name", () => {
		expect(formatDetailCard({ ...base, name: null })).toContain("Name: —");
	});
});

// ─── parseBirthDate ───────────────────────────────────────────────────────────

describe("parseBirthDate", () => {
	it("parses DD/MM format", () => {
		expect(parseBirthDate("15/06")).toEqual({ day: 15, month: 6, year: null });
	});

	it("parses DD/MM/YYYY format", () => {
		expect(parseBirthDate("25/12/1990")).toEqual({
			day: 25,
			month: 12,
			year: 1990,
		});
	});

	it("trims surrounding whitespace", () => {
		expect(parseBirthDate("  01/01  ")).toEqual({
			day: 1,
			month: 1,
			year: null,
		});
	});

	it("returns null for invalid month (> 12)", () => {
		expect(parseBirthDate("01/13")).toBeNull();
	});

	it("returns null for invalid month (0)", () => {
		expect(parseBirthDate("01/00")).toBeNull();
	});

	it("returns null for invalid day (0)", () => {
		expect(parseBirthDate("00/06")).toBeNull();
	});

	it("returns null for day > 31", () => {
		expect(parseBirthDate("32/01")).toBeNull();
	});

	it("returns null for year before 1900", () => {
		expect(parseBirthDate("01/01/1899")).toBeNull();
	});

	it("returns null for future year", () => {
		const future = new Date().getFullYear() + 1;
		expect(parseBirthDate(`01/01/${future}`)).toBeNull();
	});

	it("returns null for too many parts", () => {
		expect(parseBirthDate("01/06/1990/extra")).toBeNull();
	});

	it("returns null for only one part", () => {
		expect(parseBirthDate("15")).toBeNull();
	});

	it("returns null for non-numeric input", () => {
		expect(parseBirthDate("ab/cd")).toBeNull();
	});
});
