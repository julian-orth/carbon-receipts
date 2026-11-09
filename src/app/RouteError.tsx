import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

/** Last line of defence for render errors and failed lazy imports (e.g. after a deploy). */
export function RouteError() {
  const error = useRouteError()
  console.error(error)
  const isChunkError =
    error instanceof Error &&
    /dynamically imported module|Importing a module script failed/i.test(error.message)

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
      <title>Fehler · Carbon Receipts</title>
      <h1 className="text-2xl font-semibold">Etwas ist schiefgelaufen</h1>
      <p className="text-muted-foreground">
        {isRouteErrorResponse(error)
          ? `${error.status} ${error.statusText}`
          : isChunkError
            ? 'Es gibt eine neue Version der App. Bitte lade die Seite neu.'
            : 'Bitte lade die Seite neu. Wenn der Fehler bleibt, versuche es später erneut.'}
      </p>
      <div className="flex justify-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          Neu laden
        </button>
        <Link to="/" className="rounded-md border px-4 py-2 text-sm font-medium">
          Zur Übersicht
        </Link>
      </div>
    </main>
  )
}
