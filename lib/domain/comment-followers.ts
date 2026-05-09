export function collectWorkItemCommentFollowerIds(input: {
  subscriberIds: string[]
  creatorId: string
  assigneeId?: string | null
  existingCommentAuthorIds: string[]
}) {
  return [
    ...input.subscriberIds,
    input.creatorId,
    input.assigneeId ?? "",
    ...input.existingCommentAuthorIds,
  ].filter(Boolean)
}

export function collectDocumentCommentFollowerIds(input: {
  createdBy: string
  updatedBy: string
  existingCommentAuthorIds: string[]
}) {
  return [
    input.createdBy,
    input.updatedBy,
    ...input.existingCommentAuthorIds,
  ]
}
