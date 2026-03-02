import { conversations, createConversation } from "@grammyjs/conversations";
import { find } from "geo-tz";
import { Bot, webhookCallback } from "grammy";
import { Hono } from "hono";
import { env } from "@/env";
import { logger } from "@/logger";
import { requireRegistered } from "@/middlewares/requireRegistered.middleware";
import type { BotContext } from "@/routers/add.conversation";
import { addPersonConversation } from "@/routers/add.conversation";
import { listConversation } from "@/routers/list.conversation";
import { applyTimezone, registerUser } from "@/services/user.service";

const endpoint = `${env.BASE_URL}/bot/webhook`;

export const bot = new Bot<BotContext>(env.TG_BOT_TOKEN);

// Register the conversations plugin (uses in-memory storage by default)
bot.use(conversations());
bot.use(createConversation(addPersonConversation, "add-person"));
bot.use(createConversation(listConversation, "list-birthdays"));

const tgRoute = new Hono();

if (env.NODE_ENV === "production") {
	tgRoute.use("/webhook", webhookCallback(bot, "hono"));
	bot.api.setWebhook(endpoint);
} else {
	logger.info("Running in development mode, using long polling");
	bot.start();
}

const COMMANDS_TEXT =
	"Here's what I can do:\n\n" +
	"/start — show this message\n" +
	"/add — add a person's birthday\n" +
	"/list — list upcoming birthdays\n" +
	"/edit — edit a person's birthday\n" +
	"/delete — delete a person\n" +
	"/settimezone — set your timezone (share location or type a name like Europe/Warsaw)";

// Register the command list with Telegram so the / menu is populated
bot.api.setMyCommands([
	{ command: "start", description: "Show this message" },
	{ command: "add", description: "Add a person's birthday" },
	{ command: "list", description: "List upcoming birthdays" },
	{ command: "edit", description: "Edit a person's birthday" },
	{ command: "delete", description: "Delete a person" },
	{ command: "settimezone", description: "Set your timezone" },
]);

/**
 * /start — register user on first interaction, reply with command list.
 */
bot.command("start", async (ctx) => {
	const from = ctx.from;
	if (!from) {
		await ctx.reply("Could not identify your user. Please try again.");
		return;
	}

	try {
		await registerUser(from);
	} catch (err) {
		logger.error({ err, userId: from.id }, "Failed to register user on /start");
	}

	const name = from.first_name ?? from.username ?? "there";
	await ctx.reply(
		`Welcome to Birthday Reminder Bot, ${name}!\n\n${COMMANDS_TEXT}`,
	);
});

/**
 * /add — multi-step wizard to add a person's birthday.
 */
bot.command("add", requireRegistered, async (ctx) => {
	await ctx.conversation.enter("add-person");
});

/**
 * /list — paginated list of upcoming birthdays with inline edit/delete.
 */
bot.command("list", requireRegistered, async (ctx) => {
	await ctx.conversation.enter("list-birthdays");
});

/**
 * /edit — enter the list picker to select a person to edit.
 */
bot.command("edit", requireRegistered, async (ctx) => {
	await ctx.conversation.enter("list-birthdays");
});

/**
 * /delete — enter the list picker to select a person to delete.
 */
bot.command("delete", requireRegistered, async (ctx) => {
	await ctx.conversation.enter("list-birthdays");
});

/**
 * /settimezone [IANA timezone]
 *
 * Without argument — sends a "Share my location" button.
 * With argument — sets the timezone directly by IANA name.
 */
bot.command("settimezone", requireRegistered, async (ctx) => {
	const userId = ctx.from?.id;
	if (!userId) {
		await ctx.reply("Could not identify your user ID. Please try again.");
		return;
	}

	const tz = ctx.match?.trim();

	if (!tz) {
		await ctx.reply(
			"Share your location and I will detect your timezone automatically.\n\n" +
				"On desktop? Type your timezone directly instead:\n" +
				"/settimezone Europe/Warsaw",
			{
				reply_markup: {
					keyboard: [[{ text: "Share my location", request_location: true }]],
					resize_keyboard: true,
					one_time_keyboard: true,
				},
			},
		);
		return;
	}

	await applyTimezone(String(userId), tz, ctx);
});

/**
 * Location message handler — resolves IANA timezone from GPS via geo-tz.
 */
bot.on("message:location", async (ctx) => {
	const userId = ctx.from?.id;
	if (!userId) {
		await ctx.reply("Could not identify your user ID. Please try again.");
		return;
	}

	const { latitude, longitude } = ctx.message.location;
	logger.info(
		{ userId, latitude, longitude },
		"Received location for timezone detection",
	);

	const candidates = find(latitude, longitude);
	const tz = candidates[0];

	if (!tz) {
		await ctx.reply(
			"Could not detect a timezone for your location.\n" +
				"Please set it manually: /settimezone Europe/Warsaw",
			{ reply_markup: { remove_keyboard: true } },
		);
		return;
	}

	await applyTimezone(String(userId), tz, ctx);
});

bot.on("message", async (ctx) => {
	logger.info({ userId: ctx.from?.id }, "Received message");
	await ctx.reply(
		"Hello! I am your birthday reminder bot.\n\n" +
			"Use /add to add a birthday, /list to see upcoming ones.\n\n" +
			COMMANDS_TEXT,
	);
});

export { tgRoute };
