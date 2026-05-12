export function ScopedScreenLoading({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center px-6 py-20 text-sm text-muted-foreground">
      {label}
    </div>
  )
}
