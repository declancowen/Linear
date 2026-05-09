type PresenceTargetInput<TTargetKey extends string> = {
  [Key in TTargetKey]: string
}

type ServerPresenceActorInput = {
  currentUserId: string
  workosUserId: string
  sessionId: string
}

export type ServerPresenceHeartbeatInput<TTargetKey extends string> =
  ServerPresenceActorInput &
    PresenceTargetInput<TTargetKey> & {
      email: string
      name: string
      avatarUrl: string
      avatarImageUrl?: string | null
      activeBlockId?: string | null
    }

export type ServerPresenceClearInput<TTargetKey extends string> =
  ServerPresenceActorInput & PresenceTargetInput<TTargetKey>
