import { z } from "zod"

import {
  nullableCalendarDateSchema,
  nullableTimeSchema,
  nullableTimeZoneSchema,
  priorities,
  workStatuses,
} from "@/lib/domain/types"

export const bulkWorkItemPatchShape = {
  status: z.enum(workStatuses).optional(),
  priority: z.enum(priorities).optional(),
  assigneeId: z.string().nullable().optional(),
  assigneeIds: z.array(z.string().trim().min(1)).optional(),
  primaryProjectId: z.string().nullable().optional(),
  labelIds: z.array(z.string().min(1)).optional(),
  startDate: nullableCalendarDateSchema.optional(),
  dueDate: nullableCalendarDateSchema.optional(),
  targetDate: nullableCalendarDateSchema.optional(),
  startTime: nullableTimeSchema.optional(),
  endTime: nullableTimeSchema.optional(),
  scheduleTimeZone: nullableTimeZoneSchema.optional(),
} as const
