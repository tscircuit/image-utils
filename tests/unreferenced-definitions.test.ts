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

const definition = '<path id="unused" d="M1 1H2V2H1Z"/>'
const visible = '<path d="M7 7H8V8H7Z"/>'

for (const container of ["defs", "symbol"] as const) {
  test(`unreferenced ${container} content produces no filled shapes`, () => {
    const actual = convert(`<${container}>${definition}</${container}>`)
    expect(actual).toEqual([])
  })

  test(`unreferenced ${container} does not add geometry beside a visible path`, () => {
    const expected = convert(visible)
    expect(expected).toHaveLength(1)
    expect(
      convert(`<${container}><g>${definition}</g></${container}>${visible}`),
    ).toEqual(expected)
  })
}
