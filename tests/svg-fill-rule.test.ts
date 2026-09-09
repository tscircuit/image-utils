import { expect, test } from "bun:test"
import { createCanvas, Path2D } from "@napi-rs/canvas"
import { identity } from "transformation-matrix"
import {
  getSvgBRepShapes,
  getTransformedSvgPathRoutes,
} from "../lib/svg-to-brep-shapes"

const outer = "M0 0 H10 V10 H0 Z"
const same = `${outer} M2 2 H8 V8 H2 Z`
const opposite = `${outer} M2 2 V8 H8 V2 Z`

test.each([
  ["default nonzero", same, "", "", "nonzero", 0],
  ["explicit nonzero", same, 'fill-rule="nonzero"', "", "nonzero", 0],
  ["opposite winding", opposite, "", "", "nonzero", 1],
  ["evenodd", same, 'fill-rule="evenodd"', "", "evenodd", 1],
  ["inherited evenodd", same, "", 'fill-rule="evenodd"', "evenodd", 1],
  ["winding remains nonzero", `${same} M3 3 V7 H7 V3 Z`, "", "", "nonzero", 0],
  [
    "winding finally reaches zero",
    `${same} M3 3 V7 H7 V3 Z M4 4 V6 H6 V4 Z`,
    "",
    "",
    "nonzero",
    1,
  ],
  ["island inside a hole", `${opposite} M4 4 H6 V6 H4 Z`, "", "", "nonzero", 1],
  [
    "path overrides parent",
    same,
    'fill-rule="nonzero"',
    'fill-rule="evenodd"',
    "nonzero",
    0,
  ],
  [
    "inline style overrides attribute",
    same,
    'fill-rule="evenodd" style="fill-rule:nonzero"',
    "",
    "nonzero",
    0,
  ],
  [
    "inherited inline style",
    same,
    'fill-rule="inherit"',
    'style="fill-rule:evenodd"',
    "evenodd",
    1,
  ],
  [
    "initial resets inherited rule",
    same,
    'style="fill-rule:initial"',
    'fill-rule="evenodd"',
    "nonzero",
    0,
  ],
] as const)("SVG fill: %s", (_name, data, attributes, group, rule, holes) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><g ${group}><path ${attributes} d="${data}"/></g></svg>`
  const shapes = getSvgBRepShapes({
    svg,
    width: 10,
    height: 10,
    transform: identity(),
  })
  expect(shapes.flatMap((shape) => shape.inner_rings)).toHaveLength(holes)

  const reference = createCanvas(100, 100).getContext("2d")
  reference.scale(10, 10)
  reference.fill(new Path2D(data), rule)
  const actual = createCanvas(100, 100).getContext("2d")
  actual.translate(50, 50)
  actual.scale(10, -10)
  for (const shape of shapes) {
    actual.beginPath()
    for (const ring of [shape.outer_ring, ...shape.inner_rings]) {
      actual.moveTo(ring.vertices[0].x, ring.vertices[0].y)
      for (const p of ring.vertices.slice(1)) actual.lineTo(p.x, p.y)
      actual.closePath()
    }
    actual.fill()
  }
  expect(actual.getImageData(0, 0, 100, 100).data).toEqual(
    reference.getImageData(0, 0, 100, 100).data,
  )
})

test("fill rules belong to each path and route extraction remains flat", () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
    <path fill-rule="evenodd" d="${same}"/>
    <path fill-rule="nonzero" d="M3 3 H7 V7 H3 Z M4 4 H6 V6 H4 Z"/>
  </svg>`
  const options = { svg, width: 10, height: 10, transform: identity() }
  const shapes = getSvgBRepShapes(options)
  expect(shapes).toHaveLength(2)
  expect(shapes.map((shape) => shape.inner_rings.length)).toEqual([1, 0])
  expect(getTransformedSvgPathRoutes(options)).toHaveLength(4)
})
