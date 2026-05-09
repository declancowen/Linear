import { normalizeAuthNextPath } from "./auth-routing"

export type PasswordAuthFormFields = {
  email: string
  nextPath: string
  password: string
}

export function getPasswordAuthFormFields(
  formData: FormData
): PasswordAuthFormFields {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    nextPath: normalizeAuthNextPath(String(formData.get("next") ?? "")),
  }
}
