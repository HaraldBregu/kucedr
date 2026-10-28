import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ChevronRightIcon, EyeOffIcon, EyeIcon } from "lucide-react"

// These controls belong to the tree row: its hover and selection surface
// stays on the treeitem, independent of the consumer's Button variants.
const treeButtonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-md text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        expand:
          "size-8 text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        label:
          "min-w-0 flex-1 justify-start gap-2 py-2 text-start font-normal break-words whitespace-normal group-aria-selected/row:font-medium",
      },
    },
  }
)

function TreeButton({
  variant,
  ...props
}: Omit<ButtonPrimitive.Props, "className"> &
  VariantProps<typeof treeButtonVariants>) {
  return (
    <ButtonPrimitive className={treeButtonVariants({ variant })} {...props} />
  )
}

export type AnatomyNode = {
  id: string
  label: string
  children?: readonly AnatomyNode[]
  /** A CSS color shown as a decorative swatch before the label. */
  color?: string
  /**
   * Defaults to true. A row that is not selectable expands or collapses
   * instead, for groupings that have no single structure to select.
   */
  selectable?: boolean
}
export type AnatomyTreeProps = React.ComponentProps<"section"> & {
  /** The tree: structures with ids, labels and children. */
  data: readonly AnatomyNode[]
  /** The selected structure id, or null. */
  selectedId: string | null
  /** Called with the id a reader selects. */
  onSelectionChange: (id: string) => void
  /** Missing IDs are visible. Branches summarize their leaf descendants. */
  visibility: Readonly<Record<string, boolean>>
  /** Called with the new visibility after a show or hide. */
  onVisibilityChange: (visibility: Record<string, boolean>) => void
  /** Branches open on first render. */
  defaultExpandedIds?: readonly string[]
  /** The accessible name of the tree. */
  label?: string
  /** Classes for the root element. */
  className?: string
}
export type AnatomyIndex = {
  nodes: Map<string, AnatomyNode>
  parents: Map<string, string>
  leaves: Map<string, string[]>
}
export type AnatomyRow = {
  node: AnatomyNode
  level: number
  size: number
  position: number
}

export function anatomyIndex(data: readonly AnatomyNode[]): AnatomyIndex {
  const nodes = new Map<string, AnatomyNode>()
  const parents = new Map<string, string>()
  const leaves = new Map<string, string[]>()
  function visit(items: readonly AnatomyNode[], parent?: string): string[] {
    return items.flatMap((node) => {
      if (!node.id)
        throw new Error("Anatomy IDs must be nonempty and unique: found empty")
      if (nodes.has(node.id))
        throw new Error(
          `Anatomy IDs must be nonempty and unique: "${node.id}" repeats`
        )
      nodes.set(node.id, node)
      if (parent) parents.set(node.id, parent)
      const ids = node.children?.length
        ? visit(node.children, node.id)
        : [node.id]
      leaves.set(node.id, ids)
      return ids
    })
  }
  visit(data)
  return { nodes, parents, leaves }
}

export function leafIds(node: AnatomyNode): string[] {
  return node.children?.length ? node.children.flatMap(leafIds) : [node.id]
}

function leafState(
  ids: readonly string[],
  visibility: Readonly<Record<string, boolean>>
): boolean | "mixed" {
  const values = ids.map((id) => visibility[id] !== false)
  return values.every(Boolean) ? true : values.some(Boolean) ? "mixed" : false
}

export function visibilityState(
  node: AnatomyNode,
  visibility: Readonly<Record<string, boolean>>
): boolean | "mixed" {
  return leafState(leafIds(node), visibility)
}

/** Hides every leaf of a fully visible node, otherwise shows them all. */
export function nextVisibility(
  node: AnatomyNode,
  index: AnatomyIndex,
  visibility: Readonly<Record<string, boolean>>
): Record<string, boolean> {
  // A Map keeps IDs such as "__proto__" as ordinary keys.
  const next = new Map<string, boolean>()
  for (const id of index.nodes.keys())
    if (Object.hasOwn(visibility, id)) next.set(id, visibility[id]!)
  const ids = index.leaves.get(node.id) ?? leafIds(node)
  const value = leafState(ids, visibility) !== true
  for (const id of ids) next.set(id, value)
  return Object.fromEntries(next)
}

/** Visible rows in order. A search shows matches with their ancestors. */
export function anatomyRows(
  data: readonly AnatomyNode[],
  index: AnatomyIndex,
  expanded: ReadonlySet<string>,
  query: string
): AnatomyRow[] {
  const term = query.trim().toLocaleLowerCase()
  const included = term ? new Set<string>() : undefined
  if (included)
    for (const node of index.nodes.values()) {
      if (!node.label.toLocaleLowerCase().includes(term)) continue
      let id: string | undefined = node.id
      while (id && !included.has(id)) {
        included.add(id)
        id = index.parents.get(id)
      }
    }
  const rows: AnatomyRow[] = []
  function visit(items: readonly AnatomyNode[], level: number) {
    const visible = included ? items.filter((n) => included.has(n.id)) : items
    visible.forEach((node, position) => {
      rows.push({ node, level, size: visible.length, position: position + 1 })
      if (included || expanded.has(node.id))
        visit(node.children ?? [], level + 1)
    })
  }
  visit(data, 1)
  return rows
}

/** The roving tab stop: the active row, else its nearest visible ancestor. */
export function focusTarget(
  rows: readonly AnatomyRow[],
  activePath: readonly string[],
  parents: ReadonlyMap<string, string>
): string | undefined {
  const ids = new Set(rows.map(({ node }) => node.id))
  let id: string | undefined = activePath[0]
  while (id && !ids.has(id)) id = parents.get(id)
  return id ?? activePath.find((path) => ids.has(path)) ?? rows[0]?.node.id
}

/**
 * Brings a row into view inside its nearest scrolling container only. Unlike
 * scrollIntoView, the page itself never moves, so a pick in a viewer does not
 * jump a phone layout to the tree.
 */
function scrollWithinContainer(row: HTMLElement) {
  let container = row.parentElement
  while (container) {
    const { overflowY } = getComputedStyle(container)
    if (
      /auto|scroll/.test(overflowY) &&
      container.scrollHeight > container.clientHeight
    )
      break
    container = container.parentElement
  }
  if (!container) return
  const bounds = container.getBoundingClientRect()
  const target = row.getBoundingClientRect()
  if (target.top < bounds.top) container.scrollTop -= bounds.top - target.top
  else if (target.bottom > bounds.bottom)
    container.scrollTop += Math.min(
      target.bottom - bounds.bottom,
      target.top - bounds.top
    )
}

export function AnatomyTree({
  data,
  selectedId,
  onSelectionChange,
  visibility,
  onVisibilityChange,
  defaultExpandedIds = [],
  label = "Anatomy",
  className,
  ...props
}: AnatomyTreeProps) {
  const index = React.useMemo(() => anatomyIndex(data), [data])
  const [expanded, setExpanded] = React.useState(
    () => new Set(defaultExpandedIds)
  )
  const [query, setQuery] = React.useState("")
  // Typing stays responsive while larger trees filter.
  const deferredQuery = React.useDeferredValue(query)
  const [activePath, setActivePath] = React.useState<string[]>(() =>
    data[0] ? [data[0].id] : []
  )
  const search = React.useRef<HTMLInputElement>(null)
  const lastFocused = React.useRef<Element | null>(null)
  const refs = React.useRef(new Map<string, HTMLDivElement>())
  const helpId = React.useId()
  const searchId = React.useId()
  const searching = deferredQuery.trim() !== ""
  const groupsExpand = React.useMemo(
    () => [...index.nodes.values()].some((node) => node.selectable === false),
    [index]
  )
  const rows = React.useMemo(
    () => anatomyRows(data, index, expanded, deferredQuery),
    [data, index, expanded, deferredQuery]
  )
  const focusId = focusTarget(rows, activePath, index.parents)
  // Reveal a selection made outside the tree, such as in a 3D view: when its
  // row is not shown, expand its ancestors, then scroll the row into view.
  const [reveal, setReveal] = React.useState({ id: selectedId, scroll: false })
  if (reveal.id !== selectedId) {
    const known = !!selectedId && index.nodes.has(selectedId)
    const shown = rows.some(({ node }) => node.id === selectedId)
    setReveal({ id: selectedId, scroll: known })
    const ancestors: string[] = []
    let parent = known && !shown ? index.parents.get(selectedId!) : undefined
    while (parent) {
      ancestors.push(parent)
      parent = index.parents.get(parent)
    }
    if (ancestors.some((id) => !expanded.has(id)))
      setExpanded(new Set([...expanded, ...ancestors]))
  }
  React.useEffect(() => {
    const row = reveal.scroll && reveal.id && refs.current.get(reveal.id)
    if (row) scrollWithinContainer(row)
  }, [reveal])
  React.useLayoutEffect(() => {
    // Recover only when an update removed the focused element. Focus that
    // left the tree on purpose, even to the body, is never taken back.
    const previous = lastFocused.current
    if (!previous || previous.isConnected) return
    lastFocused.current = null
    if (document.activeElement && document.activeElement !== document.body)
      return
    if (focusId) refs.current.get(focusId)?.focus()
    else search.current?.focus()
  })
  function focus(id?: string) {
    if (id) {
      refs.current.get(id)?.focus()
    }
  }
  function toggleExpanded(id: string) {
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function activate(node: AnatomyNode) {
    if (node.selectable !== false) onSelectionChange(node.id)
    else if (node.children?.length && !searching) toggleExpanded(node.id)
  }
  function toggleVisibility(node: AnatomyNode) {
    onVisibilityChange(nextVisibility(node, index, visibility))
  }
  return (
    <section
      data-slot="anatomy-tree"
      className={cn(
        "@container/anatomy-tree flex flex-col gap-3 rounded-xl border bg-background p-4 text-foreground",
        className
      )}
      {...props}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={searchId}>
            Search {label.toLocaleLowerCase()}
          </FieldLabel>
          <Input
            ref={search}
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
      </FieldGroup>
      <p id={helpId} className="text-xs text-muted-foreground">
        {groupsExpand
          ? "Arrows navigate and expand. Enter selects, or expands a group. Space toggles visibility."
          : "Arrows navigate and expand. Enter selects. Space toggles visibility."}
      </p>
      <div
        role="tree"
        aria-label={label}
        className="flex flex-col gap-1"
        aria-describedby={helpId}
        onFocusCapture={(event) => {
          lastFocused.current = event.target
        }}
        onBlurCapture={(event) => {
          const element = event.target
          if (
            event.relatedTarget instanceof Node &&
            event.currentTarget.contains(event.relatedTarget)
          )
            return
          // Removing the focused row can also blur it. Once the update has
          // committed, an element that is still attached was left on purpose.
          queueMicrotask(() => {
            if (element.isConnected && lastFocused.current === element)
              lastFocused.current = null
          })
        }}
      >
        {rows.map(({ node, level, size, position }, rowIndex) => {
          const branch = !!node.children?.length
          const open = searching || expanded.has(node.id)
          const checked = leafState(index.leaves.get(node.id)!, visibility)
          const state =
            checked === "mixed" ? "Mixed" : checked ? "Visible" : "Hidden"
          return (
            <div
              key={node.id}
              ref={(element) => {
                if (element) refs.current.set(node.id, element)
                else refs.current.delete(node.id)
              }}
              role="treeitem"
              // Voice control users say what they see, so the name carries the
              // row's visible text: the label, then its visibility state.
              aria-label={`${node.label}, ${state.toLowerCase()}`}
              aria-level={level}
              aria-setsize={size}
              aria-posinset={position}
              aria-expanded={branch ? open : undefined}
              aria-selected={
                node.selectable === false ? undefined : selectedId === node.id
              }
              aria-checked={checked}
              tabIndex={focusId === node.id ? 0 : -1}
              onFocus={() => {
                const path = [node.id]
                let parent = index.parents.get(node.id)
                while (parent) {
                  path.push(parent)
                  parent = index.parents.get(parent)
                }
                setActivePath(path)
              }}
              onKeyDown={(event) => {
                if (
                  ![
                    "ArrowDown",
                    "ArrowUp",
                    "ArrowRight",
                    "ArrowLeft",
                    "Home",
                    "End",
                    "Enter",
                    " ",
                  ].includes(event.key)
                )
                  return
                event.preventDefault()
                if (event.key === "ArrowDown")
                  focus(rows[rowIndex + 1]?.node.id)
                if (event.key === "ArrowUp") focus(rows[rowIndex - 1]?.node.id)
                if (event.key === "Home") focus(rows[0]?.node.id)
                if (event.key === "End") focus(rows.at(-1)?.node.id)
                if (event.key === "ArrowRight" && branch) {
                  if (!open) toggleExpanded(node.id)
                  else if (rows[rowIndex + 1]?.level === level + 1)
                    focus(rows[rowIndex + 1]?.node.id)
                }
                if (event.key === "ArrowLeft") {
                  if (branch && open && !searching) toggleExpanded(node.id)
                  else focus(index.parents.get(node.id))
                }
                if (event.key === "Enter") activate(node)
                if (event.key === " ") toggleVisibility(node)
              }}
              className="group/row flex min-h-10 items-center gap-1 rounded-md px-2 text-sm outline-offset-2 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring aria-selected:bg-accent aria-selected:text-accent-foreground"
              style={{ paddingInlineStart: `${(level - 1) * 1.25 + 0.5}rem` }}
            >
              {branch ? (
                <TreeButton
                  variant="expand"
                  tabIndex={-1}
                  aria-label={`${open ? "Collapse" : "Expand"} ${node.label}`}
                  disabled={searching}
                  onClick={() => {
                    focus(node.id)
                    toggleExpanded(node.id)
                  }}
                >
                  <ChevronRightIcon aria-hidden="true" className={cn(
                                                "size-4 transition-transform motion-reduce:transition-none",
                                                open && "rotate-90"
                                              )} />
                </TreeButton>
              ) : (
                <span className="w-8 shrink-0" />
              )}
              <TreeButton
                variant="label"
                tabIndex={-1}
                onClick={() => {
                  focus(node.id)
                  activate(node)
                }}
              >
                {node.color && (
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: node.color }}
                  />
                )}
                <span className="min-w-0">{node.label}</span>
              </TreeButton>
              {/* Keeps the row's text "Heart Visible", which its name contains. */}{" "}
              <Button
                variant="ghost"
                size="xs"
                // Icons join the label once the tree has room for them.
                className="justify-start text-muted-foreground group-aria-selected/row:text-accent-foreground @sm/anatomy-tree:w-20"
                tabIndex={-1}
                // Starts with the visible state so voice control can target it.
                aria-label={`${state}: ${checked === true ? "hide" : "show"} ${node.label}`}
                onClick={() => {
                  focus(node.id)
                  toggleVisibility(node)
                }}
              >
                {checked === false ? (
                  <EyeOffIcon data-icon="inline-start" aria-hidden="true" className="hidden @sm/anatomy-tree:block" />
                ) : (
                  <EyeIcon data-icon="inline-start" aria-hidden="true" className="hidden @sm/anatomy-tree:block" />
                )}
                {state}
              </Button>
            </div>
          )
        })}
      </div>
      {!rows.length && (
        <Empty role="status">
          <EmptyHeader>
            <EmptyDescription>
              {data.length ? "No matching anatomy." : "No anatomy available."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  )
}
