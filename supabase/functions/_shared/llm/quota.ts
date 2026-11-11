// Helpers for provider quotas. Dependency-free (shared with the Deno edge function).

/** "retry-after" in seconds (Groq sends it on 429). */
export function parseRetryAfterMs(header: string | null | undefined): number | undefined {
  if (!header) return undefined
  const seconds = Number(header)
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds * 1000) : undefined
}

/** Groq reset headers look like "59.56s", "2m59.56s" or "1h2m3s". */
export function parseDurationMs(value: string | null | undefined): number | undefined {
  if (!value) return undefined
  const match = /^(?:(\d+)h)?(?:(\d+)m(?!s))?(?:(\d+(?:\.\d+)?)s)?(?:(\d+(?:\.\d+)?)ms)?$/.exec(
    value.trim(),
  )
  if (!match || match[0] === '') return undefined
  const [, h, m, s, ms] = match
  return Math.ceil(
    Number(h ?? 0) * 3_600_000 + Number(m ?? 0) * 60_000 + Number(s ?? 0) * 1000 + Number(ms ?? 0),
  )
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

/** The next 00:00 in the given IANA time zone (Gemini's daily quota resets at midnight Pacific). */
export function nextMidnight(now: Date, timeZone: string): Date {
  const p = zonedParts(now, timeZone)
  const wallClockAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  const offset = wallClockAsUtc - Math.floor(now.getTime() / 1000) * 1000
  return new Date(Date.UTC(p.year, p.month - 1, p.day + 1) - offset)
}

/** User-facing text for a used-up daily quota: when it works again, in German local time. */
export function quotaExhaustedMessage(until: Date, now: Date = new Date()): string {
  const zone = 'Europe/Berlin'
  const time = new Intl.DateTimeFormat('de-DE', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(until)
  const day = (date: Date) => {
    const p = zonedParts(date, zone)
    return `${p.year}-${p.month}-${p.day}`
  }
  const when = day(until) === day(now) ? `ab ca. ${time} Uhr` : `ab ca. morgen ${time} Uhr`
  return `Das Kontingent der kostenlosen KI-Dienste ist für heute aufgebraucht. Es geht ${when} wieder.`
}
