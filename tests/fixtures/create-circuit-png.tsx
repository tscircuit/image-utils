import { Circuit } from "tscircuit"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { convertSvgToPng } from "./convert-svg-to-png"
import React from "react"

export const createCircuitPng = async (elements: React.ReactNode) => {
  const circuit = new Circuit()
  circuit.add(elements as React.ReactElement)
  await circuit.renderUntilSettled()

  const circuitJson = circuit.toJson()
  const svg = convertCircuitJsonToPcbSvg(circuitJson)
  return convertSvgToPng(svg)
}
