import { describe, expect, it } from "vitest"

import {
  buildMentionEmailJobs,
  buildTeamInviteEmailJobs,
} from "@/lib/email/builders"

describe("email builders", () => {
  it("renders batched mention email copy for document notifications", () => {
    const [job] = buildMentionEmailJobs({
      origin: "https://linear.test",
      emails: [
        {
          notificationId: "notification_1",
          email: "alex@example.com",
          name: "Alex",
          entityTitle: "Weekly plan",
          entityType: "document",
          entityId: "document_1",
          actorName: "Sam",
          commentText: "",
          detailLabel: "Summary",
          detailText:
            "You were mentioned 3 times in this live document before notifications were sent.",
          mentionCount: 3,
        },
      ],
    })

    expect(job.subject).toBe("Sam mentioned you 3 times in Weekly plan")
    expect(job.text).toContain("Sam mentioned you 3 times in Weekly plan.")
    expect(job.text).toContain(
      "You were mentioned 3 times in this live document before notifications were sent."
    )
    expect(job.html).toContain("Sam mentioned you 3 times")
    expect(job.html).toContain("Summary")
    expect(job.html).toContain("color: #52525b; background-color: #f4f4f5;")
    expect(job.html).toContain("border-left: 3px solid #111113;")
  })

  it("renders invite email HTML for single-team and multi-team invites", () => {
    const [singleTeamJob, multiTeamJob] = buildTeamInviteEmailJobs({
      origin: "https://linear.test",
      invites: [
        {
          email: "alex@example.com",
          inviteToken: "invite_1",
          workspaceName: "Recipe Room",
          teamNames: ["Platform"],
          role: "admin",
        },
        {
          email: "sam@example.com",
          inviteToken: "invite_2",
          workspaceName: "Recipe Room",
          teamNames: ["Platform", "Support"],
          role: "member",
        },
      ],
    })

    expect(singleTeamJob.subject).toBe("Join Platform in Recipe Room")
    expect(singleTeamJob.text).toContain("Team: Platform")
    expect(singleTeamJob.html).toContain("Workspace invite")
    expect(singleTeamJob.html).toContain("the following team")
    expect(singleTeamJob.html).toContain("Accept invite")
    expect(multiTeamJob.subject).toBe("Join Recipe Room")
    expect(multiTeamJob.text).toContain("Teams: Platform, Support")
    expect(multiTeamJob.html).toContain("the following teams")
  })
})
