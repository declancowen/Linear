"use client"

import NextLink from "next/link"
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation"

export const AppLink = NextLink

export function useAppPathname() {
  return usePathname()
}

export function useAppRouter() {
  return useRouter()
}

export function useAppSearchParams() {
  return useSearchParams()
}

export type AppRouter = ReturnType<typeof useAppRouter>
export type AppSearchParams = ReturnType<typeof useAppSearchParams>
