import { expect, it } from "bun:test"
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

it("percentThreshold: 0 still reports differences", async () => {
  const image1 = await createCircuitPng01()
  const image2 = await createCircuitPng02()

  const result = await looksSame(image1, image2, {
    tolerance: 2,
    percentThreshold: 0,
  })
  expect(result.equal).toBe(false)
  expect(result.differentPixels).toBeGreaterThan(0)
})

it("percentThreshold: large threshold marks same-size images equal", async () => {
  const image1 = await createCircuitPng01()
  const image2 = await createCircuitPng02()

  const result = await looksSame(image1, image2, {
    tolerance: 2,
    percentThreshold: 100,
  })
  expect(result.equal).toBe(true)
})

it("percentThreshold: identical images stay equal", async () => {
  const image1 = await createCircuitPng01()

  const result = await looksSame(image1, image1, {
    tolerance: 2,
    percentThreshold: 0,
  })
  expect(result.equal).toBe(true)
  expect(result.differentPixels).toBe(0)
})

it("percentThreshold: negative value throws", async () => {
  const image1 = await createCircuitPng01()
  const image2 = await createCircuitPng02()

  await expect(
    looksSame(image1, image2, { percentThreshold: -1 }),
  ).rejects.toThrow('"percentThreshold"')
})
