export function parseBootstrapAppWorkspaceArgs(argv) {
  const parsed = {}

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]

    if (!value?.startsWith("--")) {
      continue
    }

    const key = value.slice(2)
    const next = argv[index + 1]

    if (!next || next.startsWith("--")) {
      parsed[key] = "true"
      continue
    }

    parsed[key] = next
    index += 1
  }

  return parsed
}

export async function getOrganizationByExternalId(workos, externalId) {
  try {
    return await workos.organizations.getOrganizationByExternalId(externalId)
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 404
    ) {
      return null
    }

    throw error
  }
}
