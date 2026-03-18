import { expect, it } from "bun:test"
import npmLooksSame from "looks-same"
import looksSame from "../lib/looks-same"
import { createCircuitPng } from "./fixtures/create-circuit-png"

const createCircuitPng01 = async () =>
  createCircuitPng(
    <board width="10mm" height="10mm">
      <resistor name="R1" footprint="0603" resistance="1k" />
    </board>,
  )

const createCircuitPng02 = async () =>
  createCircuitPng(
    <board width="10mm" height="10mm">
      <resistor name="R1" pcbX="0.2" footprint="0603" resistance="1k" />
    </board>,
  )

it("matches looks-same percent change output", async () => {
  const image1 = await createCircuitPng01()
  const image2 = await createCircuitPng02()

  const localResult = await looksSame(image1, image2, { tolerance: 2 })
  const npmResult = await npmLooksSame(image1, image2, {
    tolerance: 2,
    createDiffImage: true,
  })

  const localPercentChange =
    ((localResult.differentPixels ?? 0) / (localResult.totalPixels ?? 1)) * 100
  const npmPercentChange =
    (npmResult.differentPixels / npmResult.totalPixels) * 100

  expect(localResult.totalPixels).toBe(npmResult.totalPixels)
  expect(localResult.differentPixels).toBe(npmResult.differentPixels)
  expect(Math.abs(localPercentChange - npmPercentChange)).toBeLessThan(0.0001)
  expect("percentChange" in localResult).toBe(false)
})
