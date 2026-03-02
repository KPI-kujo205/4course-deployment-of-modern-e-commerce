import type { Conversation, ConversationFlavor } from "@grammyjs/conversations";
import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { addBirthday } from "@/services/birthday.service";
import { formatDate, parseBirthDate } from "@/utils/birthday.helpers";

export type BotContext = ConversationFlavor<Context>;
export type AddConversation = Conversation<BotContext, BotContext>;

/**
 * Multi-step wizard conversation for adding a birthday entry.
 *
 * Steps:
 *  1. Name (required)
 *  2. Birthday date — DD/MM or DD/MM/YYYY (required)
 *  3. Telegram username (optional, skippable)
 *  4. Note / description (optional, skippable)
 *  5. Reminder settings via inline keyboard
 *  6. Confirmation + save
 */
export async function addPersonConversation(
	conversation: AddConversation,
	ctx: BotContext,
): Promise<void> {
	const userId = ctx.from?.id;
	if (!userId) return;

	// ── Step 1: Name ────────────────────────────────────────────────────────────
	await ctx.reply("What's their name?", {
		reply_markup: { remove_keyboard: true },
	});

	let name = "";
	while (!name) {
		const nameCtx = await conversation.waitFor("message:text");
		const candidate = nameCtx.message.text.trim();
		if (!candidate) {
			await nameCtx.reply("Name can't be empty. Please enter their name:");
		} else {
			name = candidate;
		}
	}

	// ── Step 2: Birthday date ────────────────────────────────────────────────────
	await ctx.reply(
		"What's their birthday?\n\nSend the date as DD/MM (e.g. 25/06) or DD/MM/YYYY (e.g. 25/06/1990):",
	);

	let birthDay = 0;
	let birthMonth = 0;
	let birthYear: number | null = null;

	while (!birthDay) {
		const dateCtx = await conversation.waitFor("message:text");
		const parsed = parseBirthDate(dateCtx.message.text);
		if (!parsed) {
			await dateCtx.reply(
				"Couldn't parse that date. Please use DD/MM or DD/MM/YYYY — for example: 25/06 or 25/06/1990",
			);
		} else {
			birthDay = parsed.day;
			birthMonth = parsed.month;
			birthYear = parsed.year;
		}
	}

	// ── Step 3: Telegram username (optional) ───────────────────────────────────
	await ctx.reply(
		"Their Telegram username? (e.g. @johndoe)\n\nType it or send /skip to skip:",
	);

	let telegramUsername: string | null = null;
	const usernameCtx = await conversation.waitFor("message:text");
	const usernameRaw = usernameCtx.message.text.trim();
	if (usernameRaw !== "/skip" && usernameRaw !== "skip") {
		// Normalise — strip leading @ if present, then re-add
		telegramUsername = usernameRaw.startsWith("@")
			? usernameRaw
			: `@${usernameRaw}`;
	}

	// ── Step 4: Description / note (optional) ──────────────────────────────────
	await ctx.reply(
		"Any notes about them? (e.g. 'best friend', 'bring cake')\n\nType it or send /skip to skip:",
	);

	let description: string | null = null;
	const descCtx = await conversation.waitFor("message:text");
	const descRaw = descCtx.message.text.trim();
	if (descRaw !== "/skip" && descRaw !== "skip") {
		description = descRaw;
	}

	// ── Step 5: Reminder settings ───────────────────────────────────────────────
	let remindOnDay = true;
	let remind3DaysBefore = false;
	let remind1WeekBefore = false;

	const buildReminderKeyboard = () =>
		new InlineKeyboard()
			.text(`${remindOnDay ? "✅" : "⬜"} On the day`, "toggle_on_day")
			.text(`${remind3DaysBefore ? "✅" : "⬜"} 3 days before`, "toggle_3_days")
			.row()
			.text(`${remind1WeekBefore ? "✅" : "⬜"} 1 week before`, "toggle_1_week")
			.row()
			.text("Save", "reminders_done");

	const reminderMsg = await ctx.reply(
		"When should I remind you? Toggle the options and press Save:",
		{ reply_markup: buildReminderKeyboard() },
	);

	// Keep handling callback queries until the user presses "Save"
	while (true) {
		const cbCtx = await conversation.waitFor("callback_query:data");
		const data = cbCtx.callbackQuery.data;

		if (data === "toggle_on_day") {
			remindOnDay = !remindOnDay;
		} else if (data === "toggle_3_days") {
			remind3DaysBefore = !remind3DaysBefore;
		} else if (data === "toggle_1_week") {
			remind1WeekBefore = !remind1WeekBefore;
		} else if (data === "reminders_done") {
			await cbCtx.answerCallbackQuery();
			await cbCtx.api.editMessageReplyMarkup(
				reminderMsg.chat.id,
				reminderMsg.message_id,
				{ reply_markup: undefined },
			);
			break;
		}

		// Re-render the keyboard with updated toggles
		if (data !== "reminders_done") {
			await cbCtx.answerCallbackQuery();
			await cbCtx.api.editMessageReplyMarkup(
				reminderMsg.chat.id,
				reminderMsg.message_id,
				{
					reply_markup: buildReminderKeyboard(),
				},
			);
		}
	}

	// ── Step 6: Save ─────────────────────────────────────────────────────────────
	const result = await conversation.external(() =>
		addBirthday(String(userId), {
			name,
			telegramUsername,
			description,
			birthDay,
			birthMonth,
			birthYear,
			remindOnDay,
			remind3DaysBefore,
			remind1WeekBefore,
		}),
	);

	if (!result.success) {
		await ctx.reply(
			result.error === "invalid_date"
				? `The date ${birthDay}/${birthMonth}${birthYear ? `/${birthYear}` : ""} doesn't look valid. The entry was not saved.`
				: "Something went wrong saving the entry. Please try again later.",
		);
		return;
	}

	// Build a confirmation summary
	const reminders: string[] = [];
	if (remindOnDay) reminders.push("on the day");
	if (remind3DaysBefore) reminders.push("3 days before");
	if (remind1WeekBefore) reminders.push("1 week before");
	const reminderSummary = reminders.length > 0 ? reminders.join(", ") : "none";

	const lines = [
		`Saved! Here's a summary:`,
		``,
		`Name: ${name}`,
		`Birthday: ${formatDate(birthDay, birthMonth, birthYear)}`,
		telegramUsername ? `Telegram: ${telegramUsername}` : null,
		description ? `Note: ${description}` : null,
		`Reminders: ${reminderSummary}`,
	]
		.filter((l) => l !== null)
		.join("\n");

	await ctx.reply(lines);
}
