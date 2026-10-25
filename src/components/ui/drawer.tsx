"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"
import { cn } from "cn"

// Bottom-Sheet im shadcn-Stil auf Base UI (Drawer mit Wischen zum Schließen). Die Fläche ragt 3 rem unter den
// Bildschirmrand („bleed“), damit beim Ziehen nach oben keine Lücke entsteht.

function Drawer({ ...props }: DrawerPrimitive.Root.Props) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerContent({
  className,
  children,
  ...props
}: DrawerPrimitive.Popup.Props) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Backdrop
        data-slot="drawer-overlay"
        className="fixed inset-0 z-50 min-h-dvh bg-black opacity-[calc(var(--backdrop-opacity)*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] [--backdrop-opacity:0.3] data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:opacity-0 data-swiping:duration-0 supports-[-webkit-touch-callout:none]:absolute dark:[--backdrop-opacity:0.6]"
      />
      <DrawerPrimitive.Viewport data-slot="drawer-viewport" className="fixed inset-0 z-50 flex items-end justify-center">
        <DrawerPrimitive.Popup
          data-slot="drawer-content"
          className={cn(
            "relative -mb-12 flex max-h-[calc(94dvh+3rem)] w-full flex-col rounded-t-3xl bg-popover pb-12 text-popover-foreground shadow-2xl ring-1 ring-foreground/10 outline-none [transform:translateY(var(--drawer-swipe-movement-y))] transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-ending-style:[transform:translateY(calc(100%-3rem+2px))] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:[transform:translateY(calc(100%-3rem+2px))] data-swiping:select-none",
            className
          )}
          {...props}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden />
          {children}
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPrimitive.Portal>
  )
}

/** Inhalt des Sheets: mit der Maus lässt sich darin Text markieren, ohne das Sheet zu ziehen. */
function DrawerBody({ className, ...props }: DrawerPrimitive.Content.Props) {
  return <DrawerPrimitive.Content data-slot="drawer-body" className={className} {...props} />
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return <DrawerPrimitive.Title data-slot="drawer-title" className={cn("font-heading", className)} {...props} />
}

function DrawerDescription({ className, ...props }: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Drawer, DrawerBody, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle }
