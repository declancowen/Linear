import type { output, ZodTypeAny } from "zod"

import { bumpScopedReadModelVersionsServer } from "@/lib/server/convex"
import { handleAppContextJsonRoute } from "@/lib/server/route-handlers"
import { jsonOk } from "@/lib/server/route-response"
import { resolveConversationReadModelScopeKeysServer } from "@/lib/server/scoped-read-models"

type ConversationCreationResult = {
  conversationId?: string | null
} | null | undefined

type ConversationCreationInput<TSchema extends ZodTypeAny> = output<TSchema> & {
  currentUserId: string
}

export function handleConversationCreationRoute<TSchema extends ZodTypeAny>(
  request: Request,
  options: {
    schema: TSchema
    invalidMessage: string
    failureLogLabel: string
    failureMessage: string
    failureCode: string
    create: (
      input: ConversationCreationInput<TSchema>
    ) => Promise<ConversationCreationResult>
  }
) {
  return handleAppContextJsonRoute(request, {
    schema: options.schema,
    invalidMessage: options.invalidMessage,
    failureLogLabel: options.failureLogLabel,
    failureMessage: options.failureMessage,
    failureCode: options.failureCode,
    async handle({ session, appContext, parsed }) {
      const input = {
        currentUserId: appContext.ensuredUser.userId,
        ...(parsed as Record<string, unknown>),
      } as ConversationCreationInput<TSchema>
      const result = await options.create(input)

      if (result?.conversationId) {
        await bumpScopedReadModelVersionsServer({
          scopeKeys: await resolveConversationReadModelScopeKeysServer(
            session,
            result.conversationId
          ),
        })
      }

      return jsonOk({
        ok: true,
        conversationId: result?.conversationId ?? null,
      })
    },
  })
}
