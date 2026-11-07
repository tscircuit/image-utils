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

test("omitted fill-rule (default nonzero) keeps same-direction nested subpaths filled without a hole", () => {
  const shapes = convert('<path d="M0 0 H10 V10 H0 Z M2 2 H8 V8 H2 Z"/>')
  expect(shapes).toHaveLength(1)
  expect(shapes[0]?.inner_rings).toHaveLength(0)
})

test("explicit fill-rule=nonzero keeps same-direction nested subpaths filled without a hole", () => {
  const shapes = convert(
    '<path fill-rule="nonzero" d="M0 0 H10 V10 H0 Z M2 2 H8 V8 H2 Z"/>',
  )
  expect(shapes).toHaveLength(1)
  expect(shapes[0]?.inner_rings).toHaveLength(0)
})

test("fill-rule=evenodd creates a hole for same-direction nested subpaths", () => {
  const shapes = convert(
    '<path fill-rule="evenodd" d="M0 0 H10 V10 H0 Z M2 2 H8 V8 H2 Z"/>',
  )
  expect(shapes).toHaveLength(1)
  expect(shapes[0]?.inner_rings).toHaveLength(1)
})

test("fill-rule=nonzero creates a hole for opposite-direction nested subpaths", () => {
  const shapes = convert(
    '<path fill-rule="nonzero" d="M0 0 H10 V10 H0 Z M2 2 V8 H8 V2 Z"/>',
  )
  expect(shapes).toHaveLength(1)
  expect(shapes[0]?.inner_rings).toHaveLength(1)
})

test("inherits fill-rule from ancestor group and inline style", () => {
  const evenOddFromGroup = convert(
    '<g fill-rule="evenodd"><path d="M0 0 H10 V10 H0 Z M2 2 H8 V8 H2 Z"/></g>',
  )
  expect(evenOddFromGroup).toHaveLength(1)
  expect(evenOddFromGroup[0]?.inner_rings).toHaveLength(1)

  const nonzeroOverride = convert(
    '<g fill-rule="evenodd"><path style="fill-rule: nonzero" d="M0 0 H10 V10 H0 Z M2 2 H8 V8 H2 Z"/></g>',
  )
  expect(nonzeroOverride).toHaveLength(1)
  expect(nonzeroOverride[0]?.inner_rings).toHaveLength(0)
})
