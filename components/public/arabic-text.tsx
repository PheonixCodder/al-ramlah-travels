import * as React from "react"
import { cn } from "@/lib/utils"

export interface ArabicTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode
}

/**
 * Accessible wrapper for sacred Arabic script phrases (`OD-08`, `T-085`).
 * Guarantees `lang="ar"` and `dir="rtl"` for screen readers and bidirectional layout engines.
 */
export function ArabicText({
  children,
  className,
  style,
  ...props
}: ArabicTextProps) {
  return (
    <span
      lang="ar"
      dir="rtl"
      style={{ unicodeBidi: "isolate", ...style }}
      className={cn("font-arabic inline-block [unicode-bidi:isolate]", className)}
      {...props}
    >
      {children}
    </span>
  )
}
