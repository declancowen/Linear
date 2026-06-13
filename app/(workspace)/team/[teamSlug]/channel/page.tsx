import { TeamChannelsScreen } from "@/components/app/collaboration-screens"
import { resolveWorkspaceSeedContext } from "@/lib/server/page-seed-context"
import { buildConversationListSeed } from "@/lib/server/scoped-read-model-seeds"

import { createTeamConversationPage } from "../conversation-page"

export default createTeamConversationPage(
  TeamChannelsScreen,
  resolveWorkspaceSeedContext,
  buildConversationListSeed
)
