export function parseGeneratedApiMap(apiText) {
  const modules = new Set()
  const fullApiBody = apiText.match(
    /declare const fullApi: ApiFromModules<\{\n([\s\S]*?)\n\}>;/
  )?.[1]

  if (!fullApiBody) {
    throw new Error(
      "Could not parse fullApi module map from generated API file."
    )
  }

  const modulePattern = /^\s+(?:"([^"]+)"|([A-Za-z_$][\w$]*)): typeof /gm

  for (const match of fullApiBody.matchAll(modulePattern)) {
    modules.add(`convex/${match[1] ?? match[2]}`)
  }

  return modules
}
