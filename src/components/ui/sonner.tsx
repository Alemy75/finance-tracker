import type { CSSProperties } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { IconAlertCircle, IconAlertTriangle, IconCheckCircle, IconInfo, IconLoader } from "@/components/ui/icons"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      icons={{
        success: <IconCheckCircle className="size-4 text-income" />,
        info: <IconInfo className="size-4" />,
        warning: <IconAlertTriangle className="size-4" />,
        error: <IconAlertCircle className="size-4 text-destructive" />,
        loading: <IconLoader className="size-4 animate-spin" />,
      }}
      toastOptions={{ classNames: { toast: "font-sans !rounded-xl !shadow-lg", title: "!font-semibold" } }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
