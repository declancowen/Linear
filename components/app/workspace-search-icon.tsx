import {
  FileText,
  Folders,
  MagnifyingGlass,
  Target,
  UsersThree,
} from "@phosphor-icons/react"

import type { GlobalSearchResult } from "@/lib/domain/selectors"

export function searchResultIcon(kind: GlobalSearchResult["kind"]) {
  if (kind === "navigation") {
    return <MagnifyingGlass className="size-4" />
  }

  if (kind === "team") {
    return <UsersThree className="size-4" />
  }

  if (kind === "project") {
    return <Folders className="size-4" />
  }

  if (kind === "document") {
    return <FileText className="size-4" />
  }

  return <Target className="size-4" />
}
