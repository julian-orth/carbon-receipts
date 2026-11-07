import type { ReactNode } from 'react'

/** Table view of a chart – the accessible, exact alternative to the graphic. */
export function ChartTable({
  caption,
  columns,
  rows,
}: {
  caption: string
  columns: [string, string]
  rows: Array<[ReactNode, ReactNode]>
}) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        Als Tabelle anzeigen
      </summary>
      <table className="mt-2 w-full">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th scope="col" className="py-1 font-medium">
              {columns[0]}
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              {columns[1]}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value], index) => (
            <tr key={index} className="border-b last:border-0">
              <th scope="row" className="py-1 text-left font-normal">
                {label}
              </th>
              <td className="py-1 text-right tabular-nums">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
