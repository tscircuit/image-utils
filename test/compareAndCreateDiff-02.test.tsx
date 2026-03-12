import React from "react"
import looksSame from "../src/looks-same"
import { createCircuitPng } from "./fixtures/create-circuit-png"
import { it, expect } from "bun:test"

const createCircuitPng01 = async () =>
  createCircuitPng(
    <board width="10mm" height="10mm">
      <resistor name="R1" footprint="0603" resistance="1k" />
    </board>,
  )

it("returns equal=true for identical images", async () => {
  const image = await createCircuitPng01()
  const result = await looksSame(image, image, {
    strict: false,
    tolerance: 2,
  })

  expect(result.equal).toBe(true)
})
