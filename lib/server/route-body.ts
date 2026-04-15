import type { ZodTypeAny, output } from "zod"

import { jsonError } from "@/lib/server/route-response"

export async function parseJsonBody<TSchema extends ZodTypeAny>(
  request: Request,
  schema: TSchema,
  invalidMessage: string
): Promise<output<TSchema> | Response> {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return jsonError(invalidMessage, 400)
  }

  return parsed.data
}
