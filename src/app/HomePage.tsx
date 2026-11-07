import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export function HomePage() {
  return (
    <section aria-labelledby="home-title" className="space-y-3">
      <h1 id="home-title" className="text-3xl font-semibold tracking-tight">
        Carbon Receipts
      </h1>
      <p className="max-w-prose text-muted-foreground">
        Fotografiere deine Kassenbons und sieh, welchen CO₂-Fußabdruck deine Einkäufe haben.
      </p>
      <Button asChild>
        <Link to="/receipts">Belege hochladen</Link>
      </Button>
    </section>
  )
}
