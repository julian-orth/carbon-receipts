/* oxlint-disable jsx-a11y/prefer-tag-over-role, jsx-a11y/click-events-have-key-events -- ARIA combobox: options are rich (icon, factor, intensity), which <select>/<option> cannot render; the search input keeps focus and drives the list via aria-activedescendant */
import { Check, ChevronsUpDown, Search, Sparkles } from 'lucide-react'
import { Popover } from 'radix-ui'
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { cn } from '@/lib/utils'
import { type EmissionCategory, GROUP_LABEL } from './categories'
import { searchCategories, suggestCategories } from './category-search'
import { formatFactor, groupVisual } from './category-visuals'
import { CategoryTile, IntensityMeter } from './CategoryTile'

const GROUP_ORDER = Object.keys(GROUP_LABEL)

type Option = { key: string; categoryId: string; suggested: boolean }
type Section = { id: string; title: string; options: Option[] }

type CategoryPickerProps = {
  categories: readonly EmissionCategory[]
  value: string
  onChange: (categoryId: string) => void
  /** Receipt line, used for suggestions ("Bergkäse am Stück" → Käse). */
  receiptText: string
  /** Shown when the current value is the AI's uncertain guess. */
  uncertain?: boolean
  labelId: string
  invalid?: boolean
}

/**
 * Category combobox: search, group filter and suggestions from the receipt text. Each
 * option shows the group icon, the factor and a rough intensity, so the impact of the
 * choice is visible before it is made.
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
  receiptText,
  uncertain = false,
  labelId,
  invalid,
}: CategoryPickerProps) {
  const baseId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const selected = value ? byId.get(value) : undefined
  const groups = useMemo(
    () =>
      [...new Set(categories.map((c) => c.category_group))].toSorted(
        (a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b),
      ),
    [categories],
  )

  const sections = useMemo((): Section[] => {
    const pool = group ? categories.filter((c) => c.category_group === group) : categories
    const option = (category: EmissionCategory, suggested = false): Option => ({
      key: `${suggested ? 's' : 'o'}-${category.id}`,
      categoryId: category.id,
      suggested,
    })
    const none: Section = {
      id: 'none',
      title: 'Sonstiges',
      options: [{ key: 'none', categoryId: '', suggested: false }],
    }
    if (query.trim() !== '') {
      const found = searchCategories(pool, query)
      return [
        { id: 'results', title: 'Treffer', options: found.map((c) => option(c)) },
        ...(group ? [] : [none]),
      ]
    }
    const suggestions = group ? [] : suggestCategories(categories, receiptText, value || null)
    return [
      ...(suggestions.length > 0
        ? [
            {
              id: 'suggested',
              title: `Passend zu „${receiptText}“`,
              options: suggestions.map((c) => option(c, true)),
            },
          ]
        : []),
      ...groups
        .filter((g) => !group || g === group)
        .map((g) => ({
          id: g,
          title: GROUP_LABEL[g] ?? g,
          options: pool.filter((c) => c.category_group === g).map((c) => option(c)),
        })),
      ...(group ? [] : [none]),
    ]
  }, [categories, groups, group, query, receiptText, value])

  const flat = useMemo(() => sections.flatMap((section) => section.options), [sections])
  const activeOption = flat[Math.min(active, flat.length - 1)]
  const optionId = (key: string) => `${baseId}-${key}`

  const positionOf = useMemo(() => new Map(flat.map((option, i) => [option.key, i])), [flat])

  // Keep the keyboard-active option visible. Only the list scrolls: scrollIntoView would
  // also shift the (overflow-hidden) popover and hide its search field.
  useEffect(() => {
    const list = listRef.current
    const element = activeOption ? document.getElementById(`${baseId}-${activeOption.key}`) : null
    if (!open || !list || !element) return
    const bounds = list.getBoundingClientRect()
    const rect = element.getBoundingClientRect()
    if (rect.top < bounds.top) list.scrollTop -= bounds.top - rect.top + 6
    else if (rect.bottom > bounds.bottom) list.scrollTop += rect.bottom - bounds.bottom + 6
  }, [open, activeOption, baseId])

  function openChange(next: boolean) {
    setOpen(next)
    if (next) {
      setQuery('')
      setGroup(null)
    }
  }

  function initialActive(): number {
    const index = flat.findIndex((option) => option.categoryId === value)
    return Math.max(0, index)
  }

  function choose(option: Option | undefined) {
    if (!option) return
    onChange(option.categoryId)
    setOpen(false)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const last = flat.length - 1
    const moves: Record<string, () => number> = {
      ArrowDown: () => Math.min(last, active + 1),
      ArrowUp: () => Math.max(0, active - 1),
      PageDown: () => Math.min(last, active + 8),
      PageUp: () => Math.max(0, active - 8),
    }
    const move = moves[event.key]
    if (move) {
      event.preventDefault()
      setActive(move())
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(activeOption)
    }
  }

  const listboxId = `${baseId}-listbox`

  return (
    <Popover.Root open={open} onOpenChange={openChange}>
      <Popover.Trigger
        type="button"
        aria-labelledby={`${labelId} ${baseId}-value`}
        aria-invalid={invalid ? true : undefined}
        className={cn(
          'group flex min-h-14 w-full items-center gap-3 rounded-xl border bg-card px-3 py-2 text-left transition-colors hover:border-foreground/30 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none data-[state=open]:border-foreground/40',
          !selected && 'border-dashed border-warning/70',
        )}
      >
        <CategoryTile category={selected} />
        <span id={`${baseId}-value`} className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{selected?.label ?? 'Kategorie wählen'}</span>
          <span className="truncate text-xs text-muted-foreground">
            {selected ? (
              <>
                {formatFactor(selected)}
                {uncertain && ' · Vorschlag der KI, bitte prüfen'}
              </>
            ) : (
              'Ohne Kategorie kein CO₂-Wert'
            )}
          </span>
        </span>
        {selected && <IntensityMeter category={selected} className="max-sm:hidden" />}
        <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            setActive(initialActive())
            inputRef.current?.focus()
          }}
          className="z-50 flex max-h-[min(34rem,var(--radix-popover-content-available-height))] w-[min(32rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-[0_18px_48px_rgba(18,20,18,.18)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[.98]"
        >
          <div className="flex shrink-0 items-center gap-2 border-b px-3">
            <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded="true"
              aria-controls={listboxId}
              aria-activedescendant={activeOption ? optionId(activeOption.key) : undefined}
              aria-autocomplete="list"
              aria-label="Kategorie suchen"
              placeholder="Suchen, z. B. Käse, Hafer, Cola …"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActive(0)
              }}
              onKeyDown={onKeyDown}
              className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
            />
          </div>

          <div
            role="toolbar"
            aria-label="Nach Gruppe filtern"
            className="flex shrink-0 [scrollbar-width:none] gap-1.5 overflow-x-auto border-b px-3 py-2"
          >
            <GroupChip
              pressed={group === null}
              onClick={() => {
                setGroup(null)
                setActive(0)
              }}
            >
              Alle
            </GroupChip>
            {groups.map((g) => {
              const { icon: Icon } = groupVisual(g)
              return (
                <GroupChip
                  key={g}
                  pressed={group === g}
                  onClick={() => {
                    setGroup(group === g ? null : g)
                    setActive(0)
                  }}
                >
                  <Icon aria-hidden className="size-3.5" />
                  {GROUP_LABEL[g] ?? g}
                </GroupChip>
              )
            })}
          </div>

          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Kategorien"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5"
          >
            {flat.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Keine Kategorie gefunden. Versuch es mit einem allgemeineren Begriff.
              </p>
            )}
            {sections.map((section) =>
              section.options.length === 0 ? null : (
                <div
                  key={section.id}
                  role="group"
                  aria-labelledby={`${baseId}-section-${section.id}`}
                >
                  <p
                    id={`${baseId}-section-${section.id}`}
                    className="flex items-center gap-1.5 truncate px-2.5 pt-2.5 pb-1 text-xs font-medium text-muted-foreground"
                  >
                    {section.id === 'suggested' && (
                      <Sparkles aria-hidden className="size-3.5 text-success" />
                    )}
                    {section.title}
                  </p>
                  {section.options.map((option) => {
                    const position = positionOf.get(option.key) ?? 0
                    const category = byId.get(option.categoryId)
                    const isSelected = option.categoryId === value
                    const isActive = activeOption?.key === option.key
                    return (
                      <div
                        key={option.key}
                        id={optionId(option.key)}
                        role="option"
                        tabIndex={-1}
                        aria-selected={isSelected}
                        onPointerMove={() => {
                          if (!isActive) setActive(position)
                        }}
                        onClick={() => choose(option)}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2',
                          isActive && 'bg-muted',
                        )}
                      >
                        <CategoryTile category={category} size="sm" />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className={cn('truncate text-sm', isSelected && 'font-semibold')}>
                            {category?.label ?? 'Keine passende Kategorie'}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {category
                              ? section.id === 'results' || section.id === 'suggested'
                                ? `${GROUP_LABEL[category.category_group] ?? ''} · ${formatFactor(category)}`
                                : formatFactor(category)
                              : 'Zählt nicht zur Summe, z. B. Drogerie oder Haushalt'}
                          </span>
                        </span>
                        {category && <IntensityMeter category={category} />}
                        <Check
                          aria-hidden
                          className={cn('size-4 shrink-0', !isSelected && 'invisible')}
                        />
                      </div>
                    )
                  })}
                </div>
              ),
            )}
          </div>

          <p
            aria-hidden="true"
            className="hidden shrink-0 items-center justify-between gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground sm:flex"
          >
            <span>
              <Kbd>↑</Kbd> <Kbd>↓</Kbd> wählen · <Kbd>Enter</Kbd> übernehmen · <Kbd>Esc</Kbd>{' '}
              schließen
            </span>
            <span>Balken: CO₂ pro kg bzw. Liter</span>
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function GroupChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        pressed
          ? 'border-foreground bg-foreground text-background'
          : 'bg-card text-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border bg-muted px-1 py-px font-mono text-[10px] text-foreground">
      {children}
    </kbd>
  )
}
