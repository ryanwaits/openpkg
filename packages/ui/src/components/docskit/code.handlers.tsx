import { AnnotationHandler } from "codehike/code"
import { CodeOptions } from "./code.config"

import { line } from "./code.line"
import { lineNumbers } from "./line-numbers"
import { mark } from "./mark"
import { diff } from "./diff"
import { link } from "./link"
import { callout } from "./callout"
import { collapse } from "./collapse"
import { expandable } from "./expandable"
import { hover } from "./hover"
import { tooltip } from "./tooltip"
import { wordWrap } from "./word-wrap"
// import { fold } from "./fold"
// import { tokenTransitions } from "./token-transitions"

export function getHandlers(options: CodeOptions) {
  return [
    line,
    options.lineNumbers && lineNumbers,
    mark,
    diff,
    link,
    callout,
    ...collapse,
    expandable,
    hover,
    tooltip,
    options.wordWrap && wordWrap,
    // fold,
    // options.animate && tokenTransitions,
  ].filter(Boolean) as AnnotationHandler[]
}
