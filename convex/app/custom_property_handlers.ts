import type { MutationCtx } from "../_generated/server"

import { isValidCalendarDateString } from "../../lib/calendar-date"
import { isAllowedPhosphorIconName } from "../../lib/domain/phosphor-icon-options"
import {
  getCustomPropertyScopeType,
  isCustomPropertyDefinitionForWorkItem,
} from "../../lib/domain/labels"
import type {
  CustomPropertyOption,
  CustomPropertyType,
  CustomPropertyValue,
} from "../../lib/domain/types"
import { assertServerToken, createId, getNow } from "./core"
import {
  getCustomPropertyDefinitionDoc,
  getCustomPropertyValueDoc,
  getTeamMembershipDoc,
  getUserDoc,
  getWorkItemDoc,
  listCustomPropertyDefinitionsByTeam,
  listCustomPropertyValuesByProperty,
} from "./data"
import {
  requireEditableTeamAccess,
  requireEditableTeamDoc,
  requireReadableTeamAccess,
} from "./access"

type ServerAccessArgs = {
  serverToken: string
}

type CustomPropertyDefinitionInput = {
  teamId: string
  scopeType?: "team" | "private"
  targetType?: "workItem"
  name: string
  icon: string
  type: CustomPropertyType
  options?: CustomPropertyOption[]
}

type CreateCustomPropertyDefinitionArgs = ServerAccessArgs &
  CustomPropertyDefinitionInput & {
    currentUserId: string
  }

type UpdateCustomPropertyDefinitionArgs = ServerAccessArgs & {
  currentUserId: string
  propertyId: string
  patch: Partial<Omit<CustomPropertyDefinitionInput, "teamId" | "targetType">>
}

type ArchiveCustomPropertyDefinitionArgs = ServerAccessArgs & {
  currentUserId: string
  propertyId: string
}

type SetCustomPropertyValueArgs = ServerAccessArgs & {
  currentUserId: string
  workItemId: string
  propertyId: string
  value: CustomPropertyValue
}

type CustomPropertyValueDefinition = {
  type: CustomPropertyType
  options: CustomPropertyOption[]
  teamId: string
}

type CustomPropertyValueValidator = (
  ctx: MutationCtx,
  definition: CustomPropertyValueDefinition,
  value: CustomPropertyValue
) => void | Promise<void>

type CustomPropertyDefinitionDoc = NonNullable<
  Awaited<ReturnType<typeof getCustomPropertyDefinitionDoc>>
>

type DefinitionUpdatePatch = {
  icon?: string
  name?: string
  options?: CustomPropertyOption[]
  type?: CustomPropertyType
  updatedAt: string
}

function normalizeName(name: string) {
  return name.trim()
}

function assertAllowedIcon(icon: string) {
  if (!isAllowedPhosphorIconName(icon)) {
    throw new Error("Property icon is not available")
  }
}

function getNormalizedOptionsForType(
  type: CustomPropertyType,
  options: CustomPropertyOption[] | undefined
) {
  return isChoicePropertyType(type) ? (options ?? []) : []
}

function assertChoiceOptionsPresent(
  type: CustomPropertyType,
  options: CustomPropertyOption[]
) {
  if (isChoicePropertyType(type) && options.length === 0) {
    throw new Error("Select properties must have at least one option")
  }
}

function assertOptionLabelsValid(options: CustomPropertyOption[]) {
  const labels = options.map((option) => option.label.trim().toLowerCase())

  if (labels.some((label) => label.length === 0)) {
    throw new Error("Property option label is required")
  }

  if (new Set(labels).size !== labels.length) {
    throw new Error("Property option labels must be unique")
  }
}

function assertOptionIdsValid(options: CustomPropertyOption[]) {
  const ids = options.map((option) => option.id.trim())

  if (ids.some((id) => id.length === 0)) {
    throw new Error("Property option id is required")
  }

  if (new Set(ids).size !== ids.length) {
    throw new Error("Property option ids must be unique")
  }
}

function normalizeOptions(
  type: CustomPropertyType,
  options: CustomPropertyOption[] | undefined
) {
  const nextOptions = getNormalizedOptionsForType(type, options)
  assertChoiceOptionsPresent(type, nextOptions)
  assertOptionIdsValid(nextOptions)
  assertOptionLabelsValid(nextOptions)

  return nextOptions.map((option) => ({
    id: option.id.trim(),
    label: option.label.trim(),
    color: option.color,
  }))
}

async function assertUniquePropertyName(input: {
  ctx: MutationCtx
  exceptPropertyId?: string
  name: string
  ownerId: string | null
  scopeType: "team" | "private"
  teamId: string
}) {
  const normalized = input.name.toLowerCase()
  const definitions = await listCustomPropertyDefinitionsByTeam(
    input.ctx,
    input.teamId
  )
  const duplicate = definitions.find(
    (definition) =>
      !definition.isArchived &&
      definition.id !== input.exceptPropertyId &&
      getCustomPropertyScopeType(definition) === input.scopeType &&
      (definition.ownerId ?? null) === input.ownerId &&
      definition.name.trim().toLowerCase() === normalized
  )

  if (duplicate) {
    throw new Error("A property with this name already exists")
  }
}

async function requireEditableDefinition(
  ctx: MutationCtx,
  propertyId: string,
  currentUserId: string
) {
  const definition = await getCustomPropertyDefinitionDoc(ctx, propertyId)

  if (!definition || definition.isArchived) {
    throw new Error("Custom property not found")
  }

  if (getCustomPropertyScopeType(definition) === "private") {
    if ((definition.ownerId ?? definition.createdBy) !== currentUserId) {
      throw new Error("Custom property not found")
    }
  } else {
    await requireEditableTeamAccess(ctx, definition.teamId, currentUserId)
  }

  return definition
}

function isChoicePropertyType(type: CustomPropertyType) {
  return type === "select" || type === "multiSelect"
}

function assertChoiceValue(
  definition: { options: CustomPropertyOption[]; type: CustomPropertyType },
  value: CustomPropertyValue
) {
  const optionIds = new Set(definition.options.map((option) => option.id))

  if (definition.type === "select") {
    assertSelectValue(optionIds, value)
    return
  }

  assertMultiSelectValue(optionIds, value)
}

function assertSelectValue(
  optionIds: ReadonlySet<string>,
  value: CustomPropertyValue
) {
  if (typeof value !== "string" || !optionIds.has(value)) {
    throw new Error("Select value must match a property option")
  }
}

function assertMultiSelectValue(
  optionIds: ReadonlySet<string>,
  value: CustomPropertyValue
) {
  if (!Array.isArray(value) || value.some((entry) => !optionIds.has(entry))) {
    throw new Error("Multi-select values must match property options")
  }
}

function assertTextValue(value: CustomPropertyValue) {
  if (typeof value !== "string") {
    throw new Error("Property value must be text")
  }

  return value
}

function assertUrlValue(
  _ctx: MutationCtx,
  _definition: unknown,
  value: CustomPropertyValue
) {
  const text = assertTextValue(value)

  try {
    new URL(text)
  } catch {
    throw new Error("Property value must be a valid URL")
  }
}

function assertEmailValue(
  _ctx: MutationCtx,
  _definition: unknown,
  value: CustomPropertyValue
) {
  const text = assertTextValue(value)

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    throw new Error("Property value must be a valid email")
  }
}

function assertPhoneValue(
  _ctx: MutationCtx,
  _definition: unknown,
  value: CustomPropertyValue
) {
  const text = assertTextValue(value)

  if (!/^[+\d\s().-]{3,32}$/.test(text)) {
    throw new Error("Property value must be a valid phone number")
  }
}

function assertIntegerValue(
  _ctx: MutationCtx,
  _definition: unknown,
  value: CustomPropertyValue
) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error("Property value must be an integer")
  }
}

function assertDateValue(
  _ctx: MutationCtx,
  _definition: unknown,
  value: CustomPropertyValue
) {
  if (typeof value !== "string" || !isValidCalendarDateString(value)) {
    throw new Error("Property value must be a valid date")
  }
}

function assertCheckboxValue(
  _ctx: MutationCtx,
  _definition: unknown,
  value: CustomPropertyValue
) {
  if (typeof value !== "boolean") {
    throw new Error("Property value must be true or false")
  }
}

async function assertPersonValue(
  ctx: MutationCtx,
  teamId: string,
  value: CustomPropertyValue
) {
  if (typeof value !== "string") {
    throw new Error("Person value must be a user id")
  }

  const user = await getUserDoc(ctx, value)
  if (!user) {
    throw new Error("Person value must reference an existing user")
  }

  const membership = await getTeamMembershipDoc(ctx, teamId, value)
  if (!membership) {
    throw new Error("Person value must reference a team member")
  }
}

const valueValidators: Record<
  CustomPropertyType,
  CustomPropertyValueValidator
> = {
  text: (_ctx, _definition, value) => {
    assertTextValue(value)
  },
  integer: assertIntegerValue,
  date: assertDateValue,
  checkbox: assertCheckboxValue,
  url: assertUrlValue,
  email: assertEmailValue,
  phone: assertPhoneValue,
  person: (ctx, definition, value) =>
    assertPersonValue(ctx, definition.teamId, value),
  select: (_ctx, definition, value) => assertChoiceValue(definition, value),
  multiSelect: (_ctx, definition, value) =>
    assertChoiceValue(definition, value),
}

async function validateCustomPropertyValue(
  ctx: MutationCtx,
  definition: CustomPropertyValueDefinition,
  value: CustomPropertyValue
) {
  if (value === null) {
    return
  }

  await valueValidators[definition.type](ctx, definition, value)
}

function collectUsedChoiceOptionIds(
  type: CustomPropertyType,
  values: Array<{ value: CustomPropertyValue }>
) {
  if (type === "select") {
    return collectUsedSelectOptionIds(values)
  }

  if (type === "multiSelect") {
    return collectUsedMultiSelectOptionIds(values)
  }

  return new Set<string>()
}

function collectUsedSelectOptionIds(
  values: Array<{ value: CustomPropertyValue }>
) {
  return new Set(
    values
      .map((entry) => entry.value)
      .filter((value): value is string => typeof value === "string")
  )
}

function collectUsedMultiSelectOptionIds(
  values: Array<{ value: CustomPropertyValue }>
) {
  const usedIds = new Set<string>()

  values.forEach((entry) => {
    if (Array.isArray(entry.value)) {
      entry.value.forEach((optionId) => usedIds.add(optionId))
    }
  })

  return usedIds
}

async function assertPropertyShapeChangeAllowed({
  ctx,
  definition,
  nextOptions,
  nextType,
}: {
  ctx: MutationCtx
  definition: CustomPropertyValueDefinition & { id: string }
  nextOptions: CustomPropertyOption[]
  nextType: CustomPropertyType
}) {
  const typeChanged = definition.type !== nextType

  if (!typeChanged && !isChoicePropertyType(nextType)) {
    return
  }

  const values = await listCustomPropertyValuesByProperty(ctx, definition.id)

  if (typeChanged) {
    assertTypeChangeHasNoValues(values)
    return
  }

  assertChoiceOptionsPreserveUsedValues(nextType, nextOptions, values)
}

function assertTypeChangeHasNoValues(values: unknown[]) {
  if (values.length > 0) {
    throw new Error("Property type cannot be changed while values exist")
  }
}

function assertChoiceOptionsPreserveUsedValues(
  type: CustomPropertyType,
  nextOptions: CustomPropertyOption[],
  values: Array<{ value: CustomPropertyValue }>
) {
  const nextOptionIds = new Set(nextOptions.map((option) => option.id))
  const usedOptionIds = collectUsedChoiceOptionIds(type, values)
  const removedUsedOption = [...usedOptionIds].some(
    (optionId) => !nextOptionIds.has(optionId)
  )

  if (removedUsedOption) {
    throw new Error("Property options with existing values cannot be removed")
  }
}

async function requireCustomPropertyTeamForCreate(
  ctx: MutationCtx,
  args: CreateCustomPropertyDefinitionArgs
) {
  assertServerToken(args.serverToken)
  return requireEditableTeamDoc(ctx, args.teamId, args.currentUserId)
}

export async function createCustomPropertyDefinitionHandler(
  ctx: MutationCtx,
  args: CreateCustomPropertyDefinitionArgs
) {
  const team = await requireCustomPropertyTeamForCreate(ctx, args)
  const name = normalizeName(args.name)

  if (!name) {
    throw new Error("Property name is required")
  }
  assertAllowedIcon(args.icon)

  await assertUniquePropertyName({
    ctx,
    name,
    ownerId: args.scopeType === "private" ? args.currentUserId : null,
    scopeType: args.scopeType === "private" ? "private" : "team",
    teamId: args.teamId,
  })

  const now = getNow()
  const scopeType: "team" | "private" =
    args.scopeType === "private" ? "private" : "team"
  const definition = {
    id: createId("property"),
    workspaceId: team.workspaceId,
    teamId: args.teamId,
    scopeType,
    ownerId: scopeType === "private" ? args.currentUserId : null,
    targetType: "workItem" as const,
    name,
    icon: args.icon,
    type: args.type,
    options: normalizeOptions(args.type, args.options),
    isArchived: false,
    createdBy: args.currentUserId,
    createdAt: now,
    updatedAt: now,
  }

  await ctx.db.insert("customPropertyDefinitions", definition)

  return {
    property: definition,
  }
}

function normalizeDefinitionPatch(
  definition: CustomPropertyValueDefinition & { name: string },
  patch: UpdateCustomPropertyDefinitionArgs["patch"]
) {
  const nextName = getNextDefinitionName(definition.name, patch.name)
  const nextType = patch.type ?? definition.type
  const nextOptions = getNextDefinitionOptions(definition, patch, nextType)

  if (!nextName) {
    throw new Error("Property name is required")
  }

  return {
    nextName,
    nextOptions,
    nextType,
  }
}

function getNextDefinitionName(currentName: string, patchedName?: string) {
  return typeof patchedName === "string"
    ? normalizeName(patchedName)
    : currentName
}

function getNextDefinitionOptions(
  definition: CustomPropertyValueDefinition,
  patch: UpdateCustomPropertyDefinitionArgs["patch"],
  nextType: CustomPropertyType
) {
  if (patch.options === undefined && patch.type === undefined) {
    return definition.options
  }

  return normalizeOptions(nextType, patch.options ?? definition.options)
}

function assertDefinitionPatchIconAllowed(
  patch: UpdateCustomPropertyDefinitionArgs["patch"]
) {
  if (patch.icon !== undefined) {
    assertAllowedIcon(patch.icon)
  }
}

function createDefinitionUpdatePatch({
  icon,
  nextName,
  nextOptions,
  nextType,
  patch,
}: {
  icon?: string
  nextName: string
  nextOptions: CustomPropertyOption[]
  nextType: CustomPropertyType
  patch: UpdateCustomPropertyDefinitionArgs["patch"]
}) {
  const update: DefinitionUpdatePatch = { updatedAt: getNow() }

  applyDefinitionNameUpdate(update, patch, nextName)
  applyDefinitionIconUpdate(update, icon)
  applyDefinitionTypeUpdate(update, patch, nextType)
  applyDefinitionOptionsUpdate(update, patch, nextOptions)

  return update
}

function applyDefinitionNameUpdate(
  update: DefinitionUpdatePatch,
  patch: UpdateCustomPropertyDefinitionArgs["patch"],
  nextName: string
) {
  if (patch.name !== undefined) update.name = nextName
}

function applyDefinitionIconUpdate(
  update: DefinitionUpdatePatch,
  icon?: string
) {
  if (icon !== undefined) update.icon = icon
}

function applyDefinitionTypeUpdate(
  update: DefinitionUpdatePatch,
  patch: UpdateCustomPropertyDefinitionArgs["patch"],
  nextType: CustomPropertyType
) {
  if (patch.type !== undefined) update.type = nextType
}

function applyDefinitionOptionsUpdate(
  update: DefinitionUpdatePatch,
  patch: UpdateCustomPropertyDefinitionArgs["patch"],
  nextOptions: CustomPropertyOption[]
) {
  if (patch.options !== undefined || patch.type !== undefined) {
    update.options = nextOptions
  }
}

export async function updateCustomPropertyDefinitionHandler(
  ctx: MutationCtx,
  args: UpdateCustomPropertyDefinitionArgs
) {
  assertServerToken(args.serverToken)
  const definition = await requireEditableDefinition(
    ctx,
    args.propertyId,
    args.currentUserId
  )
  const { nextName, nextOptions, nextType } = normalizeDefinitionPatch(
    definition,
    args.patch
  )
  assertDefinitionPatchIconAllowed(args.patch)

  await assertUniquePropertyName({
    ctx,
    exceptPropertyId: definition.id,
    name: nextName,
    ownerId:
      getCustomPropertyScopeType(definition) === "private"
        ? (definition.ownerId ?? definition.createdBy)
        : null,
    scopeType: getCustomPropertyScopeType(definition),
    teamId: definition.teamId,
  })

  await assertPropertyShapeChangeAllowed({
    ctx,
    definition,
    nextOptions,
    nextType,
  })

  await ctx.db.patch(
    definition._id,
    createDefinitionUpdatePatch({
      icon: args.patch.icon,
      nextName,
      nextOptions,
      nextType,
      patch: args.patch,
    })
  )

  return {
    ok: true,
  }
}

export async function archiveCustomPropertyDefinitionHandler(
  ctx: MutationCtx,
  args: ArchiveCustomPropertyDefinitionArgs
) {
  assertServerToken(args.serverToken)
  const definition = await requireEditableDefinition(
    ctx,
    args.propertyId,
    args.currentUserId
  )

  await ctx.db.patch(definition._id, {
    isArchived: true,
    updatedAt: getNow(),
  })

  return {
    ok: true,
  }
}

async function requireCustomPropertyValueTarget(
  ctx: MutationCtx,
  args: SetCustomPropertyValueArgs
) {
  const item = await getWorkItemDoc(ctx, args.workItemId)

  if (!item) {
    throw new Error("Work item not found")
  }

  await requireReadableTeamAccess(ctx, item.teamId, args.currentUserId)
  await requireEditableTeamAccess(ctx, item.teamId, args.currentUserId)
  const definition = await getCustomPropertyDefinitionDoc(ctx, args.propertyId)

  if (!canUsePropertyDefinitionForItem(definition, item, args.currentUserId)) {
    throw new Error("Custom property not found")
  }

  return {
    definition,
    item,
  }
}

function canUsePropertyDefinitionForItem(
  definition: Awaited<ReturnType<typeof getCustomPropertyDefinitionDoc>>,
  item: NonNullable<Awaited<ReturnType<typeof getWorkItemDoc>>>,
  currentUserId: string
): definition is CustomPropertyDefinitionDoc {
  return (
    !!definition &&
    isCustomPropertyDefinitionForWorkItem(definition, item, currentUserId)
  )
}

async function writeCustomPropertyValue(
  ctx: MutationCtx,
  args: SetCustomPropertyValueArgs,
  definition: CustomPropertyDefinitionDoc,
  itemId: string
) {
  const existing = await getCustomPropertyValueDoc(
    ctx,
    args.workItemId,
    args.propertyId
  )

  if (args.value === null) {
    await deleteCustomPropertyValueIfPresent(ctx, existing)
    return { ok: true, value: null }
  }

  await upsertCustomPropertyValue(ctx, args, definition, existing, itemId)
  return { ok: true }
}

async function deleteCustomPropertyValueIfPresent(
  ctx: MutationCtx,
  existing: Awaited<ReturnType<typeof getCustomPropertyValueDoc>>
) {
  if (existing) {
    await ctx.db.delete(existing._id)
  }
}

async function upsertCustomPropertyValue(
  ctx: MutationCtx,
  args: SetCustomPropertyValueArgs,
  definition: NonNullable<
    Awaited<ReturnType<typeof getCustomPropertyDefinitionDoc>>
  >,
  existing: Awaited<ReturnType<typeof getCustomPropertyValueDoc>>,
  itemId: string
) {
  const now = getNow()

  if (existing) {
    await ctx.db.patch(existing._id, {
      value: args.value,
      updatedBy: args.currentUserId,
      updatedAt: now,
    })
    return
  }

  await ctx.db.insert("customPropertyValues", {
    id: createId("property_value"),
    workspaceId: definition.workspaceId,
    teamId: definition.teamId,
    workItemId: itemId,
    propertyId: definition.id,
    value: args.value,
    createdBy: args.currentUserId,
    updatedBy: args.currentUserId,
    createdAt: now,
    updatedAt: now,
  })
}

export async function setCustomPropertyValueHandler(
  ctx: MutationCtx,
  args: SetCustomPropertyValueArgs
) {
  assertServerToken(args.serverToken)
  const { definition, item } = await requireCustomPropertyValueTarget(ctx, args)

  await validateCustomPropertyValue(ctx, definition, args.value)
  return writeCustomPropertyValue(ctx, args, definition, item.id)
}
