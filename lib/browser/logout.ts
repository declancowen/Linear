"use client"

export function submitLogoutForm(returnTo: string) {
  if (typeof document === "undefined") {
    return
  }

  const form = document.createElement("form")
  form.method = "POST"
  form.action = `/auth/logout?returnTo=${encodeURIComponent(returnTo)}`
  document.body.appendChild(form)
  form.submit()
}
