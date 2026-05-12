"use client"

import { useState } from "react"

export function useWorkItemCorePickerState() {
  const [typePickerOpen, setTypePickerOpen] = useState(false)
  const [statusPickerOpen, setStatusPickerOpen] = useState(false)
  const [statusQuery, setStatusQuery] = useState("")
  const [priorityPickerOpen, setPriorityPickerOpen] = useState(false)
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false)
  const [assigneeQuery, setAssigneeQuery] = useState("")

  return {
    assigneePickerOpen,
    assigneeQuery,
    priorityPickerOpen,
    setAssigneePickerOpen,
    setAssigneeQuery,
    setPriorityPickerOpen,
    setStatusPickerOpen,
    setStatusQuery,
    setTypePickerOpen,
    statusPickerOpen,
    statusQuery,
    typePickerOpen,
  }
}
