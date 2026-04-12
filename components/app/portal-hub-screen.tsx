import {
  ArrowSquareOut,
  CardsThree,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { buildAppDestination, portalApps } from "@/lib/portal"

const portalCards = [
  {
    appId: "teams",
    icon: UsersThree,
  },
  {
    appId: "projects",
    icon: CardsThree,
  },
] as const

export function PortalHubScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <div className="flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Choose a workspace
          </h1>
          <p className="text-sm text-muted-foreground">
            You&apos;re signed in. Open the product surface you want to use.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {portalCards.map(({ appId, icon: Icon }) => {
            const app = portalApps[appId]
            const primaryHref = buildAppDestination(appId)
            const primaryLabel = `Open ${app.name}`

            return (
              <Card
                key={app.id}
                className="border-border/70"
              >
                <CardHeader>
                  <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon />
                  </div>
                  <CardTitle className="text-2xl">{app.name}</CardTitle>
                  <CardDescription className="leading-6">
                    {app.description}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="flex items-center gap-3">
                  <Button asChild className="flex-1">
                    <a href={primaryHref}>
                      {primaryLabel}
                      <ArrowSquareOut data-icon="inline-end" />
                    </a>
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </div>
    </main>
  )
}
