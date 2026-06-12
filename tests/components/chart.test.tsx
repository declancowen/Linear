import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart"

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>()

  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  }
})

describe("ChartTooltipContent", () => {
  it("does not render the default row when a custom formatter returns null", () => {
    render(
      <ChartContainer config={{ requests: { label: "Requests" } }}>
        <ChartTooltipContent
          active
          formatter={() => null}
          hideLabel
          payload={[
            {
              dataKey: "requests",
              name: "Requests",
              payload: {},
              value: 42,
            },
          ]}
        />
      </ChartContainer>
    )

    expect(screen.queryByText("Requests")).not.toBeInTheDocument()
    expect(screen.queryByText("42")).not.toBeInTheDocument()
  })
})
