import Link from "next/link"
import { Compass, Home, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function RootNotFoundPage() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen w-full items-center justify-center bg-background px-4 py-16 text-foreground"
    >
      <div className="flex w-full max-w-lg flex-col items-center gap-5 rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-gold/40 bg-primary/5 text-primary">
          <Compass className="size-7" aria-hidden="true" />
        </div>

        <div className="flex flex-col gap-2">
          <p className="font-mono text-xs font-semibold tracking-widest text-gold-text uppercase tabular-nums">
            404 · Page Not Found
          </p>
          <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            This destination could not be found
          </h1>
          <p className="text-sm text-muted-foreground">
            The link you followed may have moved or expired. Explore our custom
            Haramain Journey Planner or speak directly with an Umrah &amp; Hajj
            advisor.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            nativeButton={false}
            render={<Link href="/" />}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Home className="size-4" />
            <span>Explore Umrah &amp; Hajj Packages</span>
          </Button>

          <Button
            variant="outline"
            nativeButton={false}
            render={
              <a
                href="https://wa.me/923274029701"
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <MessageCircle className="size-4" />
            <span>WhatsApp Lahore Desk</span>
          </Button>
        </div>
      </div>
    </main>
  )
}
