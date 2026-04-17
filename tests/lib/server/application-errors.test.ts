import {
  ApplicationError,
  coerceApplicationError,
  isApplicationError,
} from "@/lib/server/application-errors"

describe("application errors", () => {
  it("coerces known messages into typed application errors", () => {
    const error = coerceApplicationError(new Error("Conversation not found"), [
      {
        match: "Conversation not found",
        status: 404,
        code: "CHAT_CONVERSATION_NOT_FOUND",
      },
    ])

    expect(error).toBeInstanceOf(ApplicationError)
    expect(error).toMatchObject({
      message: "Conversation not found",
      status: 404,
      code: "CHAT_CONVERSATION_NOT_FOUND",
    })
  })

  it("returns existing application errors without remapping them", () => {
    const error = new ApplicationError("Read only", 403, {
      code: "CHAT_READ_ONLY",
    })

    expect(coerceApplicationError(error, [])).toBe(error)
    expect(isApplicationError(error)).toBe(true)
  })
})
