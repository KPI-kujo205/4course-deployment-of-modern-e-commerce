import { z } from "zod";

const currentYear = () => new Date().getFullYear();

/**
 * Validates that a day/month(/year) combination is a real calendar date.
 * Uses the Date constructor rollover trick: new Date(2000, 1, 30) rolls over
 * to March, so checking getMonth() === month - 1 catches invalid days.
 */
function isRealCalendarDate(
	day: number,
	month: number,
	year: number | null,
): boolean {
	const refYear = year ?? 2000;
	const d = new Date(refYear, month - 1, day);
	return d.getMonth() === month - 1 && d.getDate() === day;
}

/**
 * Zod schema for an already-parsed birth date object.
 * Validates numeric ranges and real calendar dates (no Feb 30, etc).
 * Year is optional — when provided it must be a plausible birth year.
 */
export const birthDateObjectSchema = z
	.object({
		day: z.number().int().min(1).max(31),
		month: z.number().int().min(1).max(12),
		year: z.number().int().min(1900).nullable(),
	})
	.refine(({ year }) => year === null || year <= currentYear(), {
		message: "Year cannot be in the future",
		path: ["year"],
	})
	.refine(({ day, month, year }) => isRealCalendarDate(day, month, year), {
		message: "Not a real calendar date",
		path: ["day"],
	});

export type BirthDateObject = z.infer<typeof birthDateObjectSchema>;

/**
 * Zod schema that parses a "DD/MM" or "DD/MM/YYYY" string into a BirthDateObject.
 * Returns the parsed object on success; safeParse returns null on failure.
 */
export const birthDateStringSchema = z
	.string()
	.trim()
	.transform((val, ctx) => {
		const parts = val.split("/");
		if (parts.length < 2 || parts.length > 3) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Expected DD/MM or DD/MM/YYYY",
			});
			return z.NEVER;
		}

		const day = Number(parts[0]);
		const month = Number(parts[1]);
		const year = parts[2] ? Number(parts[2]) : null;

		if (!Number.isInteger(day) || !Number.isInteger(month)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Day and month must be integers",
			});
			return z.NEVER;
		}
		if (year !== null && !Number.isInteger(year)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Year must be an integer",
			});
			return z.NEVER;
		}

		return { day, month, year };
	})
	.pipe(birthDateObjectSchema);
