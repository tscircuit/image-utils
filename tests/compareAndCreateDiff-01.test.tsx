import { expect, it } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import npmLooksSame from "looks-same"
import looksSame from "../lib/looks-same"
import { createCircuitPng } from "./fixtures/create-circuit-png"

const SNAPSHOT_OUTPUT_DIR = path.join(process.cwd(), "tests", "snapshots")

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

it("creates a PNG diff file for different images", async () => {
  await fs.mkdir(SNAPSHOT_OUTPUT_DIR, { recursive: true })

  const image1 = await createCircuitPng01()
  const image2 = await createCircuitPng02()

  const diffPath = path.join(SNAPSHOT_OUTPUT_DIR, `image-01-diff.png`)
  const result = await looksSame(image1, image2, {
    strict: false,
    tolerance: 2,
  })

  expect(result.equal).toBe(false)

  await looksSame.createDiff({
    reference: image1,
    current: image2,
    diff: diffPath,
    highlightColor: "#ff00ff",
    tolerance: 2,
  })

  const npmLooksSameDiffBuffer = await npmLooksSame.createDiff({
    reference: image1,
    current: image2,
    highlightColor: "#ff00ff",
    tolerance: 2,
  })

  const diffBuffer = await fs.readFile(diffPath)
  const diffComparison = await npmLooksSame(
    diffBuffer,
    npmLooksSameDiffBuffer,
    {
      strict: false,
      tolerance: 0,
    },
  )

  expect(diffBuffer.length).toBeGreaterThan(0)
  expect(npmLooksSameDiffBuffer.byteLength).toBeGreaterThan(0)

  // Compare this library's output with the npm looks-same output
  expect(diffComparison.equal).toBe(true)
})
