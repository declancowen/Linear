"use client"

import { useParams } from "next/navigation"

import { DocumentDetailScreen } from "@/components/app/screens"

export default function DocumentPage() {
  const params = useParams<{ documentId: string }>()
  return <DocumentDetailScreen documentId={params.documentId} />
}
