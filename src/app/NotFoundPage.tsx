import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <section aria-labelledby="not-found-title" className="space-y-3">
      <h1 id="not-found-title" className="text-2xl font-semibold">
        Seite nicht gefunden
      </h1>
      <Link to="/" className="underline underline-offset-4">
        Zur Startseite
      </Link>
    </section>
  )
}
