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

for (const container of [
  "defs",
  "symbol",
  "clipPath",
  "mask",
  "marker",
  "pattern",
]) {
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

test("visible groups and paths remain in document order around definitions", () => {
  expect(
    convert(`<g>${visible}<defs><g>${definition}</g></defs>${definition}</g>`),
  ).toEqual(convert(`${visible}${definition}`))
})

test("prefixed definition containers are excluded without hiding visible siblings", () => {
  expect(
    convert(
      `<s:defs xmlns:s="http://www.w3.org/2000/svg">${definition}</s:defs>${visible}`,
    ),
  ).toEqual(convert(visible))
})

test("comments and quoted tag delimiters do not disturb definition boundaries", () => {
  expect(
    convert(
      `<!-- </defs> ${definition} --><defs data-description="a > b">${definition}</defs>${visible}`,
    ),
  ).toEqual(convert(visible))
})
