import {Hono} from "hono";
import {getHealthStatus} from "@/services/health.service";

const indexRouter = new Hono();

indexRouter.get("/ping", (c) => {
	return c.text("pong", 200);
});

indexRouter.get("/health", async (c) => {
	const result = await getHealthStatus();

	if (result.status === "error") {
		return c.json(result, 503);
	}

	return c.json(result, 200);
});

export { indexRouter };
