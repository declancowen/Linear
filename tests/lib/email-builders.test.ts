import { describe, expect, it } from "vitest"

import { buildMentionEmailJobs } from "@/lib/email/builders"

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
  })
})
