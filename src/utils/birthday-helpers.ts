import { birthDateStringSchema } from "@/schemas/birth-date.schema";
import type { BirthdayEntry } from "@/services/birthday.service";

export const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

export function formatDate(
	day: number,
	month: number,
	year: number | null,
): string {
	const monthName = MONTHS[month - 1] ?? "???";
	return year ? `${day} ${monthName} ${year}` : `${day} ${monthName}`;
}

export function formatDaysUntil(days: number): string {
	if (days === 0) return "today!";
	if (days === 1) return "tomorrow";
	return `in ${days} days`;
}

/** Single-line summary used in list buttons: "John — 5 Mar (in 3 days)" */
export function formatEntryLine(entry: BirthdayEntry): string {
	const monthShort = (MONTHS[entry.birthMonth - 1] ?? "???").slice(0, 3);
	const when = formatDaysUntil(entry.daysUntil);
	const nameStr = entry.name ?? "Unknown";
	return `${nameStr} — ${entry.birthDay} ${monthShort} (${when})`;
}

/** Full detail card text for a birthday entry. */
export function formatDetailCard(entry: BirthdayEntry): string {
	const reminders: string[] = [];
	if (entry.remindOnDay) reminders.push("on the day");
	if (entry.remind3DaysBefore) reminders.push("3 days before");
	if (entry.remind1WeekBefore) reminders.push("1 week before");
	const reminderStr = reminders.length > 0 ? reminders.join(", ") : "none";

	const lines = [
		`Name: ${entry.name ?? "—"}`,
		`Birthday: ${formatDate(entry.birthDay, entry.birthMonth, entry.birthYear)}`,
		`Coming up: ${formatDaysUntil(entry.daysUntil)}`,
		entry.telegramUsername ? `Telegram: ${entry.telegramUsername}` : null,
		entry.description ? `Note: ${entry.description}` : null,
		`Reminders: ${reminderStr}`,
	]
		.filter((l) => l !== null)
		.join("\n");

	return lines;
}

/** Parse DD/MM or DD/MM/YYYY — returns null on invalid input. */
export function parseBirthDate(
	input: string,
): { day: number; month: number; year: number | null } | null {
	const result = birthDateStringSchema.safeParse(input);
	return result.success ? result.data : null;
}
