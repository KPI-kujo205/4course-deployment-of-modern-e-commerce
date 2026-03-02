import "dotenv/config";

import {serve} from "@hono/node-server";
import {Hono} from "hono";
import {onError} from "stoker/middlewares";
import {db} from "@/db";
import {env} from "@/env";
import {logger} from "@/logger";
import {loggerMiddleware} from "@/middlewares/logger.middleware";
import {indexRouter, tgRoute} from "@/routers";

const app = new Hono()
	.use(loggerMiddleware)
	.route("/bot", tgRoute)
	.route("/", indexRouter);

app.onError((err, c) => {
	logger.error({ err, path: c.req.path, method: c.req.method }, err.message);
	return onError(err, c);
});

logger.info("Registered routes:");

app.routes.forEach((route) => {
	logger.info(`${route.method} ${route.path}`);
});

const server = serve(
	{
		fetch: app.fetch,
		port: env.PORT,
	},
	(info) => {
		logger.info(`Server is running on http://localhost:${info.port}`);
	},
);

const shutdown = async (signal: string) => {
	logger.info(`${signal} received. Starting graceful shutdown...`);
	server.close();
	await db.destroy();
	logger.info("Graceful shutdown complete");
	process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
