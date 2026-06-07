"use client"

import { useState, type ReactNode } from "react"
import { format } from "date-fns"
import {
  CalendarBlank,
  FileText,
  Folder,
  LinkSimple,
  SidebarSimple,
  TreeStructure,
  UserCircle,
  UsersThree,
} from "@phosphor-icons/react"

import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import {
  documentTitleConstraints,
  getTextInputLimitState,
} from "@/lib/domain/input-constraints"
import { isCustomPropertyDefinitionForDocument } from "@/lib/domain/labels"
import {
  getProject,
  getProjectHref,
  getTeam,
  getUser,
  getWorkItem,
} from "@/lib/domain/selectors"
import type { AppData, Document as AppDocument } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { cn } from "@/lib/utils"
import { CollapsibleRightSidebar } from "@/components/ui/collapsible-right-sidebar"
import { Input } from "@/components/ui/input"

import {
  DetailSidebarAddPropertyRow,
  DetailSidebarCustomPropertyRow,
  DetailRelationLink,
  renderDetailSidebarTerm,
} from "./detail-sidebar-primitives"
import {
  CustomPropertyDefinitionDialog,
  CustomPropertyValueControl,
} from "./custom-property-controls"

function getDocumentKindLabel(kind: AppDocument["kind"]) {
  if (kind === "private-document") {
    return "Private"
  }

  if (kind === "team-document") {
    return "Team"
  }

  return "Workspace"
}

function getDocumentScopeLabel(data: AppData, document: AppDocument) {
  if (document.kind === "private-document") {
    return "Private"
  }

  if (document.kind === "team-document" && document.teamId) {
    return getTeam(data, document.teamId)?.name ?? "Team"
  }

  return "Workspace"
}

function DocumentDetailSidebarHeader({
  onClose,
  showClose = true,
}: {
  onClose?: () => void
  showClose?: boolean
}) {
  return (
    <div className="flex h-11 items-center gap-2 border-b border-line px-3">
      <FileText className="size-[14px] text-fg-3" />
      <span className="text-[12px] font-medium text-fg-2">Document</span>
      {showClose && onClose ? (
        <button
          type="button"
          aria-label="Close document properties"
          className="ml-auto grid size-6 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground"
          onClick={onClose}
        >
          <SidebarSimple className="size-[14px]" />
        </button>
      ) : null}
    </div>
  )
}

function DocumentSidebarTitleEditor({
  document,
  editable,
  onRenameTitle,
}: {
  document: AppDocument
  editable: boolean
  onRenameTitle?: (title: string) => void
}) {
  const [draftTitle, setDraftTitle] = useState(document.title)
  const [editing, setEditing] = useState(false)
  const titleLimitState = getTextInputLimitState(draftTitle, {
    ...documentTitleConstraints,
    allowEmpty: true,
  })

  function commitTitle() {
    if (!titleLimitState.canSubmit) {
      return
    }

    const normalizedTitle = draftTitle.trim() || "Untitled document"
    setEditing(false)

    if (normalizedTitle === document.title) {
      setDraftTitle(normalizedTitle)
      return
    }

    setDraftTitle(normalizedTitle)

    if (onRenameTitle) {
      onRenameTitle(normalizedTitle)
      return
    }

    useAppStore.getState().renameDocument(document.id, normalizedTitle)
  }

  if (!editable) {
    return (
      <h2 className="mb-2.5 text-[22px] leading-[1.25] font-semibold tracking-[-0.012em]">
        {document.title}
      </h2>
    )
  }

  if (!editing) {
    return (
      <button
        type="button"
        aria-label="Edit document title"
        disabled={!editable}
        className={cn(
          "mb-2.5 block w-full rounded-md text-left text-[22px] leading-[1.25] font-semibold tracking-[-0.012em]",
          editable &&
            "transition-colors hover:bg-surface-3 focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:outline-none"
        )}
        onClick={() => {
          if (editable) {
            setDraftTitle(document.title)
            setEditing(true)
          }
        }}
      >
        {document.title}
      </button>
    )
  }

  return (
    <div className="mb-3">
      <Input
        value={draftTitle}
        onBlur={commitTitle}
        onChange={(event) => setDraftTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            event.currentTarget.blur()
          }
        }}
        maxLength={documentTitleConstraints.max}
        className="h-auto rounded-md border-none bg-transparent px-0 py-0 text-[22px] leading-[1.25] font-semibold tracking-[-0.012em] shadow-none focus-visible:bg-background focus-visible:px-1 focus-visible:ring-1"
        placeholder="Untitled document"
      />
      <FieldCharacterLimit
        state={titleLimitState}
        limit={documentTitleConstraints.max}
        className="mt-1"
      />
    </div>
  )
}

function DocumentSidebarStaticRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
}) {
  return (
    <>
      {renderDetailSidebarTerm(label, icon)}
      <dd className="m-0 flex min-h-7 items-center py-1 text-[12.5px] text-foreground">
        {value}
      </dd>
    </>
  )
}

function DocumentSidebarProperties({
  data,
  document,
}: {
  data: AppData
  document: AppDocument
}) {
  const createdBy = getUser(data, document.createdBy)?.name ?? "Unknown"
  const updatedBy = getUser(data, document.updatedBy)?.name ?? "Unknown"

  return (
    <section className="border-b border-line-soft pb-5">
      <dl className="grid grid-cols-[minmax(7rem,0.42fr)_minmax(0,1fr)] gap-x-4 gap-y-1 text-[12.5px]">
        <DocumentSidebarStaticRow
          icon={<SidebarSimple className="size-[13px]" />}
          label="Kind"
          value={getDocumentKindLabel(document.kind)}
        />
        <DocumentSidebarStaticRow
          icon={<UsersThree className="size-[13px]" />}
          label="Space"
          value={getDocumentScopeLabel(data, document)}
        />
        <DocumentSidebarStaticRow
          icon={<UserCircle className="size-[13px]" />}
          label="Created by"
          value={createdBy}
        />
        <DocumentSidebarStaticRow
          icon={<UserCircle className="size-[13px]" />}
          label="Updated by"
          value={updatedBy}
        />
        <DocumentSidebarStaticRow
          icon={<CalendarBlank className="size-[13px]" />}
          label="Created"
          value={format(new Date(document.createdAt), "MMM d, yyyy")}
        />
        <DocumentSidebarStaticRow
          icon={<CalendarBlank className="size-[13px]" />}
          label="Updated"
          value={format(new Date(document.updatedAt), "MMM d, yyyy")}
        />
      </dl>
    </section>
  )
}

function DocumentSidebarRelations({
  data,
  document,
}: {
  data: AppData
  document: AppDocument
}) {
  const linkedProjects = document.linkedProjectIds
    .map((projectId) => getProject(data, projectId))
    .filter((project): project is NonNullable<typeof project> =>
      Boolean(project)
    )
  const linkedItems = document.linkedWorkItemIds
    .map((itemId) => getWorkItem(data, itemId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  const linkedDocuments = (document.linkedDocumentIds ?? [])
    .map(
      (documentId) =>
        data.documents.find((entry) => entry.id === documentId) ?? null
    )
    .filter((entry): entry is AppDocument => Boolean(entry))

  if (
    linkedProjects.length === 0 &&
    linkedItems.length === 0 &&
    linkedDocuments.length === 0
  ) {
    return (
      <section className="pt-5">
        <h3 className="mb-2 text-[12px] font-semibold tracking-[0.04em] text-fg-3 uppercase">
          Relations
        </h3>
        <p className="text-[12.5px] leading-5 text-fg-4">No linked content.</p>
      </section>
    )
  }

  return (
    <section className="pt-5">
      <h3 className="mb-2 text-[12px] font-semibold tracking-[0.04em] text-fg-3 uppercase">
        Relations
      </h3>
      <div className="flex flex-col gap-1.5">
        {linkedProjects.map((project) => (
          <DetailRelationLink
            key={project.id}
            href={getProjectHref(data, project) ?? `/projects/${project.id}`}
            icon={<Folder className="size-3" />}
            label="Project"
            title={project.name}
          />
        ))}
        {linkedItems.map((item) => (
          <DetailRelationLink
            key={item.id}
            href={`/items/${item.id}`}
            icon={<TreeStructure className="size-3" />}
            label="Item"
            title={item.title}
          />
        ))}
        {linkedDocuments.map((linkedDocument) => (
          <DetailRelationLink
            key={linkedDocument.id}
            href={`/docs/${linkedDocument.id}`}
            icon={<LinkSimple className="size-3" />}
            label="Doc"
            title={linkedDocument.title}
          />
        ))}
      </div>
    </section>
  )
}

function getDocumentCustomPropertyDefinitions(
  data: AppData,
  document: AppDocument
) {
  return data.customPropertyDefinitions
    .filter((definition) =>
      isCustomPropertyDefinitionForDocument(
        definition,
        document,
        data.currentUserId
      )
    )
    .sort((left, right) => left.name.localeCompare(right.name))
}

function getDocumentCustomPropertyValue(
  data: AppData,
  document: AppDocument,
  definition: AppData["customPropertyDefinitions"][number]
) {
  return (
    data.customPropertyValues.find(
      (entry) =>
        (entry.targetType ?? "workItem") === "document" &&
        (entry.targetId ?? entry.workItemId) === document.id &&
        entry.propertyId === definition.id
    ) ?? null
  )
}

function getDocumentPropertyCreateScope(document: AppDocument):
  | {
      scopeType: "team"
      teamId: string
      workspaceId: string
    }
  | {
      scopeType: "workspace" | "private"
      teamId: null
      workspaceId: string
    }
  | null {
  if (document.kind === "item-description") {
    return null
  }

  if (document.kind === "team-document" && document.teamId) {
    return {
      scopeType: "team",
      teamId: document.teamId,
      workspaceId: document.workspaceId,
    }
  }

  if (document.kind === "private-document") {
    return {
      scopeType: "private",
      teamId: null,
      workspaceId: document.workspaceId,
    }
  }

  return {
    scopeType: "workspace",
    teamId: null,
    workspaceId: document.workspaceId,
  }
}

function DocumentSidebarCustomPropertyRows({
  data,
  document,
  editable,
  onEditProperty,
}: {
  data: AppData
  document: AppDocument
  editable: boolean
  onEditProperty: (
    definition: AppData["customPropertyDefinitions"][number]
  ) => void
}) {
  const archiveCustomPropertyDefinition = useAppStore(
    (state) => state.archiveCustomPropertyDefinition
  )
  const definitions = getDocumentCustomPropertyDefinitions(data, document)

  return definitions.map((definition) => (
    <DetailSidebarCustomPropertyRow
      key={definition.id}
      definition={definition}
      editable={editable}
      onEditProperty={() => onEditProperty(definition)}
      onRemoveProperty={() => void archiveCustomPropertyDefinition(definition.id)}
    >
      <CustomPropertyValueControl
        data={data}
        document={document}
        definition={definition}
        value={getDocumentCustomPropertyValue(data, document, definition)}
        editable={editable}
      />
    </DetailSidebarCustomPropertyRow>
  ))
}

export function DocumentDetailSidebarSurface({
  data,
  document,
  editable,
  open = true,
  onClose,
  onRenameTitle,
  showHeaderClose = true,
}: {
  data: AppData
  document: AppDocument
  editable: boolean
  open?: boolean
  onClose?: () => void
  onRenameTitle?: (title: string) => void
  showHeaderClose?: boolean
}) {
  const [customPropertyDialogOpen, setCustomPropertyDialogOpen] =
    useState(false)
  const [editingCustomProperty, setEditingCustomProperty] = useState<
    AppData["customPropertyDefinitions"][number] | null
  >(null)
  const createScope = getDocumentPropertyCreateScope(document)

  return (
    <>
      <CollapsibleRightSidebar
        open={open}
        width="26.25rem"
        className="border-l border-line bg-surface"
      >
        <DocumentDetailSidebarHeader
          onClose={onClose}
          showClose={showHeaderClose}
        />
        <div className="no-scrollbar flex-1 overflow-y-auto px-6 py-[22px]">
          <DocumentSidebarTitleEditor
            document={document}
            editable={editable}
            onRenameTitle={onRenameTitle}
          />
          <DocumentSidebarProperties data={data} document={document} />
          <section className="border-b border-line-soft py-5">
            <dl className="grid grid-cols-[minmax(7rem,0.42fr)_minmax(0,1fr)] gap-x-4 gap-y-1 text-[12.5px]">
              <DocumentSidebarCustomPropertyRows
                data={data}
                document={document}
                editable={editable}
                onEditProperty={(definition) => {
                  setEditingCustomProperty(definition)
                  setCustomPropertyDialogOpen(true)
                }}
              />
              {createScope ? (
                <DetailSidebarAddPropertyRow
                  disabled={!editable}
                  onOpen={() => {
                    setEditingCustomProperty(null)
                    setCustomPropertyDialogOpen(true)
                  }}
                />
              ) : null}
            </dl>
          </section>
          <DocumentSidebarRelations data={data} document={document} />
        </div>
      </CollapsibleRightSidebar>
      {createScope ? (
        <CustomPropertyDefinitionDialog
          open={customPropertyDialogOpen}
          definition={editingCustomProperty}
          scopeType={createScope.scopeType}
          targetType="document"
          teamId={createScope.teamId}
          workspaceId={createScope.workspaceId}
          onOpenChange={(nextOpen) => {
            setCustomPropertyDialogOpen(nextOpen)
            if (!nextOpen) {
              setEditingCustomProperty(null)
            }
          }}
        />
      ) : null}
    </>
  )
}
