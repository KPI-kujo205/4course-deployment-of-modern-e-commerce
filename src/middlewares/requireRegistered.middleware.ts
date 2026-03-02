import type { Context, MiddlewareFn } from "grammy";

import { userExists } from "@/db/repos/user.repo";

/**
 * grammY middleware that restricts a command to registered users only.
 *
 * A user is considered registered once they have run /start, which upserts
 * their row into the `users` table. If the user is not registered the bot
 * replies with an instructional message and does not call the next handler.
 *
 * Usage — pass as a pre-handler argument to bot.command():
 *
 *   bot.command("add", requireRegistered, async (ctx) => { ... });
 *   bot.command("list", requireRegistered, async (ctx) => { ... });
 *   bot.command("delete", requireRegistered, async (ctx) => { ... });
 */
export const requireRegistered: MiddlewareFn<Context> = async (ctx, next) => {
	const userId = ctx.from?.id;

	if (!userId || !(await userExists(String(userId)))) {
		await ctx.reply("You need to register first. Send /start to get started.");
		return;
	}

	await next();
};
