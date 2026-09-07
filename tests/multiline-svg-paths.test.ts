import { expect, test } from "bun:test"
import {
  getSvgBRepShapes,
  getTransformedSvgPathRoutes,
} from "../lib/svg-to-brep-shapes"

const dimensions = {
  width: 4,
  height: 4,
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
}

for (const quote of ['"', "'"]) {
  for (const newline of ["\n", "\r\n"]) {
    test(`extracts ${JSON.stringify(newline)} path data in ${quote} attributes`, () => {
      const data = [
        "M 0 0",
        "H 4",
        "V 4",
        "H 0",
        "Z",
        "M 1 1",
        "H 3",
        "V 3",
        "H 1",
        "Z",
      ]
      const svg = `<svg viewBox="0 0 4 4"><path d=${quote}${data.join(newline)}${quote}/></svg>`
      const singleLine = `<svg viewBox="0 0 4 4"><path d=${quote}${data.join(" ")}${quote}/></svg>`
      const routes = getTransformedSvgPathRoutes({ svg, ...dimensions })
      expect(routes).toHaveLength(2)
      expect(routes).toEqual(
        getTransformedSvgPathRoutes({ svg: singleLine, ...dimensions }),
      )
      const shapes = getSvgBRepShapes({ svg, ...dimensions })
      expect(shapes).toHaveLength(1)
      expect(shapes[0]!.inner_rings).toHaveLength(1)
      expect(shapes).toEqual(
        getSvgBRepShapes({ svg: singleLine, ...dimensions }),
      )
    })
  }
}

test("keeps both single-line and multiline paths in a formatted SVG", () => {
  const svg = `<svg viewBox="0 0 4 4">
    <path d="M 0 0 H 1 V 1 H 0 Z"/>
    <path
      fill="red"
      d="
        M 2 2
        H 4 V 4 H 2
        Z
      "
    />
  </svg>`
  expect(getTransformedSvgPathRoutes({ svg, ...dimensions })).toHaveLength(2)
  expect(getSvgBRepShapes({ svg, ...dimensions })).toHaveLength(2)
})
