import { randomBytes } from "crypto"

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const JOIN_CODE_LENGTH = 12
const MAX_GENERATION_ATTEMPTS = 5

export function generateJoinCode(length = JOIN_CODE_LENGTH) {
  const bytes = randomBytes(length)
  let value = ""

  for (let index = 0; index < length; index += 1) {
    value += JOIN_CODE_ALPHABET[bytes[index] % JOIN_CODE_ALPHABET.length]
  }

  return value
}

export function isJoinCodeConflict(error: unknown) {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("join code is already in use")
  )
}

export async function withGeneratedJoinCode<T>(
  task: (joinCode: string) => Promise<T>
) {
  let lastError: unknown = null

  for (
    let attempt = 0;
    attempt < MAX_GENERATION_ATTEMPTS;
    attempt += 1
  ) {
    try {
      return await task(generateJoinCode())
    } catch (error) {
      lastError = error

      if (!isJoinCodeConflict(error)) {
        throw error
      }
    }
  }

  throw lastError ?? new Error("Unable to generate a unique join code")
}
