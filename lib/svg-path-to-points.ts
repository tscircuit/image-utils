import SVGPathCommander from "svg-path-commander"

export interface Point {
  x: number
  y: number
}

function sampleCurveSegment(
  segmentPath: string,
  samplesPerUnit: number,
): Point[] {
  const commander = new SVGPathCommander(segmentPath)
  const length = commander.getTotalLength()
  const numSamples = Math.max(2, Math.ceil(length * samplesPerUnit))

  const points: Point[] = []
  for (let i = 1; i <= numSamples; i++) {
    const t = (i / numSamples) * length
    const point = commander.getPointAtLength(t)
    points.push({ x: point.x, y: point.y })
  }
  return points
}

export function svgPathToPoints(
  svgPath: string,
  samplesPerUnit = 10,
): Point[][] {
  const pathCommander = new SVGPathCommander(svgPath)
  pathCommander.toAbsolute()
  const segments = pathCommander.segments

  const result: Point[][] = []
  let currentPoints: Point[] = []
  let currentX = 0
  let currentY = 0
  let subpathStartX = 0
  let subpathStartY = 0
  let cubicControl: Point | null = null
  let quadraticControl: Point | null = null

  for (const segment of segments) {
    const cmd = segment[0]
    if (cmd !== "C" && cmd !== "S") cubicControl = null
    if (cmd !== "Q" && cmd !== "T") quadraticControl = null

    switch (cmd) {
      case "M": {
        if (currentPoints.length > 0) {
          result.push(currentPoints)
        }
        currentX = segment[1]
        currentY = segment[2]
        subpathStartX = currentX
        subpathStartY = currentY
        currentPoints = [{ x: currentX, y: currentY }]
        break
      }

      case "L": {
        currentX = segment[1]
        currentY = segment[2]
        currentPoints.push({ x: currentX, y: currentY })
        break
      }

      case "H": {
        currentX = segment[1]
        currentPoints.push({ x: currentX, y: currentY })
        break
      }

      case "V": {
        currentY = segment[1]
        currentPoints.push({ x: currentX, y: currentY })
        break
      }

      case "Z": {
        if (currentX !== subpathStartX || currentY !== subpathStartY) {
          currentPoints.push({ x: subpathStartX, y: subpathStartY })
        }
        currentX = subpathStartX
        currentY = subpathStartY
        break
      }

      case "C": {
        cubicControl = { x: segment[3], y: segment[4] }
        const endX = segment[5]
        const endY = segment[6]
        const segmentPath = `M ${currentX} ${currentY} C ${segment[1]} ${segment[2]} ${segment[3]} ${segment[4]} ${endX} ${endY}`
        const sampledPoints = sampleCurveSegment(segmentPath, samplesPerUnit)
        currentPoints.push(...sampledPoints)
        currentX = endX
        currentY = endY
        break
      }

      case "S": {
        const endX = segment[3]
        const endY = segment[4]
        // S inherits the previous cubic control point, which would be lost in
        // the isolated path passed to sampleCurveSegment.
        const controlX = cubicControl ? 2 * currentX - cubicControl.x : currentX
        const controlY = cubicControl ? 2 * currentY - cubicControl.y : currentY
        const segmentPath = `M ${currentX} ${currentY} C ${controlX} ${controlY} ${segment[1]} ${segment[2]} ${endX} ${endY}`
        cubicControl = { x: segment[1], y: segment[2] }
        const sampledPoints = sampleCurveSegment(segmentPath, samplesPerUnit)
        currentPoints.push(...sampledPoints)
        currentX = endX
        currentY = endY
        break
      }

      case "Q": {
        quadraticControl = { x: segment[1], y: segment[2] }
        const endX = segment[3]
        const endY = segment[4]
        const segmentPath = `M ${currentX} ${currentY} Q ${segment[1]} ${segment[2]} ${endX} ${endY}`
        const sampledPoints = sampleCurveSegment(segmentPath, samplesPerUnit)
        currentPoints.push(...sampledPoints)
        currentX = endX
        currentY = endY
        break
      }

      case "T": {
        const endX = segment[1]
        const endY = segment[2]
        const controlX: number = quadraticControl
          ? 2 * currentX - quadraticControl.x
          : currentX
        const controlY: number = quadraticControl
          ? 2 * currentY - quadraticControl.y
          : currentY
        const segmentPath = `M ${currentX} ${currentY} Q ${controlX} ${controlY} ${endX} ${endY}`
        quadraticControl = { x: controlX, y: controlY }
        const sampledPoints = sampleCurveSegment(segmentPath, samplesPerUnit)
        currentPoints.push(...sampledPoints)
        currentX = endX
        currentY = endY
        break
      }

      case "A": {
        const endX = segment[6]
        const endY = segment[7]
        const segmentPath = `M ${currentX} ${currentY} A ${segment[1]} ${segment[2]} ${segment[3]} ${segment[4]} ${segment[5]} ${endX} ${endY}`
        const sampledPoints = sampleCurveSegment(segmentPath, samplesPerUnit)
        currentPoints.push(...sampledPoints)
        currentX = endX
        currentY = endY
        break
      }
    }
  }

  if (currentPoints.length > 0) {
    result.push(currentPoints)
  }

  return result.map((points) => {
    const deduped: Point[] = []
    for (const point of points) {
      if (
        deduped.length === 0 ||
        Math.abs(deduped[deduped.length - 1].x - point.x) > 1e-9 ||
        Math.abs(deduped[deduped.length - 1].y - point.y) > 1e-9
      ) {
        deduped.push(point)
      }
    }
    return deduped
  })
}
