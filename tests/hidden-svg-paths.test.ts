import { expect, test } from "bun:test"
import { identity } from "transformation-matrix"
import { getSvgBRepShapes } from "../lib/svg-to-brep-shapes"

const convert = (body: string) =>
  getSvgBRepShapes({
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${body}</svg>`,
    width: 10,
    height: 10,
    transform: identity(),
  })

test("visible path control produces painted BRep geometry", () => {
  expect(convert('<path d="M1 1 H9 V9 H1 Z"/>')).toHaveLength(1)
})

for (const [label, body] of [
  ["path display=none", '<path display="none" d="M1 1 H9 V9 H1 Z"/>'],
  [
    "path style display:none",
    '<path style="display: none" d="M1 1 H9 V9 H1 Z"/>',
  ],
  [
    "parent g display=none",
    '<g display="none"><path d="M1 1 H9 V9 H1 Z"/></g>',
  ],
  [
    "parent g style display:none",
    '<g style="display: none"><path d="M1 1 H9 V9 H1 Z"/></g>',
  ],
  ["path visibility=hidden", '<path visibility="hidden" d="M1 1 H9 V9 H1 Z"/>'],
  [
    "path visibility=collapse",
    '<path visibility="collapse" d="M1 1 H9 V9 H1 Z"/>',
  ],
  [
    "path style visibility:hidden",
    '<path style="visibility: hidden" d="M1 1 H9 V9 H1 Z"/>',
  ],
  [
    "parent g visibility=hidden without override",
    '<g visibility="hidden"><path d="M1 1 H9 V9 H1 Z"/></g>',
  ],
] as const) {
  test(`excludes hidden geometry for ${label}`, () => {
    expect(convert(body)).toEqual([])
  })
}

test("descendant visibility=visible overrides inherited visibility=hidden", () => {
  const expected = convert('<path d="M1 1 H9 V9 H1 Z"/>')
  expect(
    convert(
      '<g visibility="hidden"><path visibility="visible" d="M1 1 H9 V9 H1 Z"/></g>',
    ),
  ).toEqual(expected)
  expect(
    convert(
      '<g style="visibility: hidden"><path style="visibility: visible" d="M1 1 H9 V9 H1 Z"/></g>',
    ),
  ).toEqual(expected)
})

test("descendant cannot restore rendering inside a display:none subtree", () => {
  expect(
    convert(
      '<g display="none"><path display="inline" visibility="visible" style="display: block; visibility: visible" d="M1 1 H9 V9 H1 Z"/></g>',
    ),
  ).toEqual([])
})
