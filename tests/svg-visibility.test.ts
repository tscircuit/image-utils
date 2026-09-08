import { expect, test } from "bun:test"
import { identity } from "transformation-matrix"
import { getSvgBRepShapes } from "../lib/svg-to-brep-shapes"

const path = '<path d="M1 1 H9 V9 H1 Z"/>'
function count(content: string) {
  return getSvgBRepShapes({
    svg: `<svg viewBox="0 0 10 10">${content}</svg>`,
    width: 10,
    height: 10,
    transform: identity(),
  }).length
}

test("invalid inline values do not override valid presentation values", () => {
  expect(count(`<g display="none" style="display:bogus">${path}</g>`)).toBe(0)
  expect(
    count(`<g visibility="hidden" style="visibility:bogus">${path}</g>`),
  ).toBe(0)
})
for (const [name, content, expected] of [
  ["visible", path, 1],
  ["hidden path", path.replace("<path", '<path display="none"'), 0],
  ["inline display", path.replace("<path", '<path style="display: none"'), 0],
  ["hidden group", `<g display="none">${path}</g>`, 0],
  [
    "cannot restore a display-none subtree",
    `<g display="none"><g display="inline">${path}</g></g>`,
    0,
  ],
  ["visibility hidden", `<g visibility="hidden">${path}</g>`, 0],
  ["visibility collapse", `<g visibility="collapse">${path}</g>`, 0],
  [
    "child restores visibility",
    `<g visibility="hidden"><g visibility="visible">${path}</g></g>`,
    1,
  ],
  [
    "inline overrides presentation attribute",
    `<g display="none" style="display:inline">${path}</g>`,
    1,
  ],
  [
    "visibility inherited",
    `<g visibility="hidden"><g visibility="inherit">${path}</g></g>`,
    0,
  ],
  [
    "visibility initial",
    `<g visibility="hidden"><g visibility="initial">${path}</g></g>`,
    1,
  ],
  [
    "important survives a later declaration",
    `<g style="display:none!important;display:inline">${path}</g>`,
    0,
  ],
  [
    "later declaration wins",
    `<g style="display:none;display:inline">${path}</g>`,
    1,
  ],
  ["visible sibling survives", `<g display="none">${path}</g>${path}`, 1],
] as const) {
  test(name, () => expect(count(content)).toBe(expected))
}
