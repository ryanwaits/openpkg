import React from "react"
import { DocsKitCode } from "./code"
import { DocsKitInlineCode } from "./code.inline"
// import { CodeGroup } from "./code.tabs"
// import { WithNotes } from "./notes"
// import { TooltipLink } from "./tooltip"
// import { HoverLink, WithHover } from "./hover"
// import { ScrollyCoding } from "./scrollycoding"
// import { Spotlight } from "./spotlight"
// import { Slideshow } from "./slideshow"

export function addDocsKit<
  T extends Record<string, React.ElementType | string>,
>(components: T): T {
  return {
    ...components,
    DocsKitCode,
    DocsKitInlineCode,
    // CodeGroup,
    // WithHover,
    // WithNotes,
    // ScrollyCoding,
    // Spotlight,
    // Slideshow,
    a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
      // if (props.href?.startsWith("hover:")) {
        // return <HoverLink {...props} />
      // }
      // if (props.href?.startsWith("tooltip:")) {
        // return <TooltipLink {...props} />
      // }
      return React.createElement(components?.a || "a", props)
    },
  }
}
