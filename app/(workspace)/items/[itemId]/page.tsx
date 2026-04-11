"use client"

import { useParams } from "next/navigation"

import { WorkItemDetailScreen } from "@/components/app/screens"

export default function WorkItemPage() {
  const params = useParams<{ itemId: string }>()
  return <WorkItemDetailScreen itemId={params.itemId} />
}
