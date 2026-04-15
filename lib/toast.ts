import { sileo } from "sileo"

// The dark mode configuration required by Sileo
const darkThemeConfig = {
  fill: "black",
  styles: {
    title: "text-white!",
    description: "text-white/75!",
  }
}

// Ensure the incoming arguments are correctly mapped
function extractTitleAndDesc(arg1: any, arg2?: any) {
  let title = "Notification"
  let description = undefined

  if (typeof arg1 === "string") {
    title = arg1
    if (arg2 && typeof arg2 === "object" && arg2.description) {
      description = arg2.description
    } else if (typeof arg2 === "string") {
      description = arg2
    }
  } else if (arg1 && typeof arg1 === "object") {
    title = arg1.title || title
    description = arg1.description
  }

  return { title, description }
}

let toastCounter = 0;

export const toast = {
  success: (msg: any, options?: any) => {
    const { title, description } = extractTitleAndDesc(msg, options)
    sileo.success({ title, description, ...darkThemeConfig })
    return ++toastCounter;
  },
  error: (msg: any, options?: any) => {
    const { title, description } = extractTitleAndDesc(msg, options)
    sileo.error({ title, description, ...darkThemeConfig })
    return ++toastCounter;
  },
  info: (msg: any, options?: any) => {
    const { title, description } = extractTitleAndDesc(msg, options)
    sileo.info({ title, description, ...darkThemeConfig })
    return ++toastCounter;
  },
  warning: (msg: any, options?: any) => {
    const { title, description } = extractTitleAndDesc(msg, options)
    // Sileo might not have a formal warning method, info is a safe fallback
    if (typeof (sileo as any).warning === 'function') {
      (sileo as any).warning({ title, description, ...darkThemeConfig })
    } else {
      sileo.info({ title, description, ...darkThemeConfig })
    }
    return ++toastCounter;
  },
  loading: (msg: any, options?: any) => {
    const { title, description } = extractTitleAndDesc(msg, options)
    sileo.info({ title, description: description || "Please wait...", ...darkThemeConfig })
    return ++toastCounter;
  },
  dismiss: (id?: any) => {
    // Basic FTP simulation of Sonner dismiss if Sileo doesn't support ID dismissals natively
    // Sileo toasts automatically dismiss, so this is mostly a no-op safety wrapper
  }
}

// Export default for flexibility
export default toast;
