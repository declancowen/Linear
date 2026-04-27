import type { Connection, Room } from "partykit/server"

import type { CollaborationLimits } from "../../../lib/collaboration/limits"
import { PartyKitCollaborationError } from "./errors"

type MaybeDocumentConnectionState = {
  kind?: unknown
  claims?: {
    role?: unknown
  }
}

function isEditorConnection(connection: Connection<MaybeDocumentConnectionState>) {
  return (
    connection.state?.kind === "doc" &&
    connection.state.claims?.role === "editor"
  )
}

export function assertDocumentRoomAdmission(
  room: Room,
  limits: CollaborationLimits,
  currentConnection?: Connection
) {
  const connections =
    typeof room.getConnections === "function"
      ? [...room.getConnections<MaybeDocumentConnectionState>()].filter(
          (connection) => connection !== currentConnection
        )
      : []

  if (connections.length >= limits.maxConnectionsPerRoom) {
    throw new PartyKitCollaborationError("collaboration_too_many_connections")
  }

  const editorCount = connections.filter(isEditorConnection).length

  if (editorCount >= limits.maxEditorsPerRoom) {
    throw new PartyKitCollaborationError("collaboration_too_many_connections")
  }
}
