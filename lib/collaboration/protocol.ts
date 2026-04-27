export const COLLABORATION_PROTOCOL_VERSION = 1
export const RICH_TEXT_COLLABORATION_SCHEMA_VERSION = 1

export function isSupportedCollaborationProtocolVersion(value: unknown) {
  return value === COLLABORATION_PROTOCOL_VERSION
}

export function isSupportedRichTextCollaborationSchemaVersion(value: unknown) {
  return value === RICH_TEXT_COLLABORATION_SCHEMA_VERSION
}
