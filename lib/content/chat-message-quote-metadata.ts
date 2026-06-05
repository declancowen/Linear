export const CHAT_QUOTE_SOURCE_MESSAGE_ID_ATTRIBUTE =
  "data-chat-source-message-id"

const CHAT_QUOTE_SOURCE_MESSAGE_ID_PATTERN = /^[A-Za-z0-9:_-]{1,128}$/

export function normalizeChatQuoteSourceMessageId(
  value: string | null | undefined
) {
  const trimmedValue = value?.trim()

  if (
    !trimmedValue ||
    !CHAT_QUOTE_SOURCE_MESSAGE_ID_PATTERN.test(trimmedValue)
  ) {
    return null
  }

  return trimmedValue
}
