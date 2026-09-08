import assert from "node:assert/strict"
import { test } from "node:test"
import { svgPathToPoints } from "../lib/svg-path-to-points.ts"

// Also run with Node >=22.6:
// node --experimental-strip-types --test tests/large-curve-samples.test.mjs
// Bun permits argument lists larger than V8, so Bun alone misses this failure.
for (const segment of [
  "C5000 0 15000 0 20000 0",
  "S10000 0 20000 0",
  "Q10000 0 20000 0",
  "T20000 0",
  "A10000 10000 0 0 1 20000 0",
]) {
  test(`samples a large ${segment[0]} segment without argument overflow`, () => {
    const [points] = svgPathToPoints(`M0 0 ${segment}`)
    assert.ok(points.length >= 200000)
    assert.deepEqual(points[0], { x: 0, y: 0 })
    const end = points.at(-1)
    assert.ok(Math.abs(end.x - 20000) < 1e-6)
    assert.ok(Math.abs(end.y) < 1e-6)
    assert.ok(
      points.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)),
    )
  })
}
