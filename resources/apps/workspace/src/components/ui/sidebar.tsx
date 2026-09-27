import * as React from "react"

import { cn } from "@/lib/utils"

interface SidebarContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) throw new Error("useSidebar must be used within a SidebarProvider")
  return context
}

interface SidebarProviderProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const SidebarProvider = React.forwardRef<HTMLDivElement, SidebarProviderProps>(
  ({ className, defaultOpen = true, open: openProp, onOpenChange, style, ...props }, ref) => {
    const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
    const open = openProp ?? internalOpen
    const setOpen = React.useCallback(
      (nextOpen: boolean) => {
        if (openProp === undefined) setInternalOpen(nextOpen)
        onOpenChange?.(nextOpen)
      },
      [onOpenChange, openProp],
    )
    const value = React.useMemo(
      () => ({ open, setOpen }),
      [open, setOpen],
    )

    return (
      <SidebarContext.Provider value={value}>
        <div
          ref={ref}
          data-slot="sidebar-wrapper"
          className={cn("group/sidebar-wrapper flex min-h-0 w-full", className)}
          style={{ "--sidebar-width": "240px", ...style } as React.CSSProperties}
          {...props}
        />
      </SidebarContext.Provider>
    )
  },
)
SidebarProvider.displayName = "SidebarProvider"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  collapsible?: "offcanvas" | "none"
}

const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
  ({ children, className, collapsible = "offcanvas", style, ...props }, ref) => {
    const { open } = useSidebar()
    const state = open || collapsible === "none" ? "expanded" : "collapsed"

    return (
      <div
        ref={ref}
        data-slot="sidebar"
        data-state={state}
        data-collapsible={state === "collapsed" ? collapsible : ""}
        className={cn(
          "group relative h-full w-(--sidebar-width) shrink-0 transition-[width] duration-200 ease-linear motion-reduce:transition-none group-data-[resizing=true]/sidebar-wrapper:transition-none",
          "data-[collapsible=offcanvas]:w-0",
          className,
        )}
        style={style}
        {...props}
      >
        <div
          data-slot="sidebar-container"
          className={cn(
            "absolute inset-y-0 left-0 z-10 flex h-full w-(--sidebar-width) transition-transform duration-200 ease-linear motion-reduce:transition-none group-data-[resizing=true]/sidebar-wrapper:transition-none",
            "group-data-[collapsible=offcanvas]:-translate-x-full",
          )}
        >
          <div
            data-sidebar="sidebar"
            data-slot="sidebar-inner"
            className="relative flex size-full flex-col border-r border-sidebar-border bg-background text-sidebar-foreground"
          >
            {children}
          </div>
        </div>
      </div>
    )
  },
)
Sidebar.displayName = "Sidebar"

const SidebarContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="sidebar-content"
      className={cn("flex min-h-0 flex-1 flex-col overflow-hidden group-data-[resizing=true]/sidebar-wrapper:pointer-events-none", className)}
      {...props}
    />
  ),
)
SidebarContent.displayName = "SidebarContent"

const SidebarFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="sidebar-footer"
      className={cn("shrink-0 border-t border-sidebar-border p-2", className)}
      {...props}
    />
  ),
)
SidebarFooter.displayName = "SidebarFooter"

const SidebarInset = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <main
      ref={ref}
      data-slot="sidebar-inset"
      className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col bg-background group-data-[resizing=true]/sidebar-wrapper:transition-none", className)}
      {...props}
    />
  ),
)
SidebarInset.displayName = "SidebarInset"

const SidebarResizeHandle = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-label="Resize sidebar"
    className={cn(
      "absolute inset-y-0 right-[-4px] z-10 w-2 cursor-col-resize touch-none",
      "after:absolute after:inset-y-3 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-sidebar-foreground/45 after:opacity-0 after:transition-opacity",
      "hover:after:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-foreground/50 focus-visible:after:opacity-100",
      className,
    )}
    {...props}
  />
))
SidebarResizeHandle.displayName = "SidebarResizeHandle"

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
  SidebarProvider,
  SidebarResizeHandle,
}
