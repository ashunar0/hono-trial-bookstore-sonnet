import { createEndpoint, errorResponses, NotFound } from "hono-kit";
import { z } from "zod";
import { requireRole } from "#/auth";
import { rejectReturn } from "#/domains/order/index";
import { rejectInputSchema, ReturnStatusConflict } from "#/domains/order/rules";
import { returnResponseSchema } from "../../../orders/_response";
import { readReturn } from "../../_read";

export const POST = createEndpoint(
  {
    auth: requireRole("staff"),
    request: { param: z.object({ id: z.string() }), json: rejectInputSchema },
    responses: { 200: returnResponseSchema, ...errorResponses(NotFound, ReturnStatusConflict) },
  },
  async (c, reply) => {
    const { id } = c.req.valid("param");
    const result = await rejectReturn(c.var.deps, id, c.req.valid("json").reason, c.get("now"));
    if (!result.ok) return reply.failure(result.error);
    const shown = await readReturn(c.var.deps.db, id);
    if (shown === undefined) return reply.failure(NotFound.code);
    return reply.success(shown);
  },
);
