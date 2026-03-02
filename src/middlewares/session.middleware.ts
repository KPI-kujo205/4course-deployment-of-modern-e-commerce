import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";


// make middleware for tg bot instead
async function sessionMiddleware(c: Context<AppVars>, next: Next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }
  c.set("user", session.user);
  c.set("session", session.session);
  await next();
}

export default sessionMiddleware;
