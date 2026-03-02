import type {MiddlewareHandler} from "hono";
import {logger} from "@/logger";

export const loggerMiddleware: MiddlewareHandler = async (c, next) => {
	const start = Date.now();

	await next();

	const duration = Date.now() - start;

	logger.info({
		msg: "HTTP Request",
		method: c.req.method,
		path: c.req.path,
		status: c.res.status,
		duration,
	});
};
