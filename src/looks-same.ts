import { readFile, writeFile } from "node:fs/promises"
import { PNG } from "pngjs"

const DEFAULT_TOLERANCE = 2
const DEFAULT_HIGHLIGHT = { r: 255, g: 0, b: 255, a: 255 }

type ImageInput = Buffer | string

type LooksSameOptions = {
  strict?: boolean
  tolerance?: number
}

type CreateDiffOptions = {
  reference: ImageInput
  current: ImageInput
  diff: string
  highlightColor?: string
  tolerance?: number
}

const parsePng = (buffer: Buffer): PNG | null => {
  try {
    return PNG.sync.read(buffer)
  } catch {
    return null
  }
}

const getBuffer = async (input: ImageInput) => {
  if (Buffer.isBuffer(input)) return input
  return readFile(input)
}

const parseHexColor = (color?: string) => {
  if (!color) return DEFAULT_HIGHLIGHT
  const match = /^#?([0-9a-fA-F]{6})$/.exec(color.trim())
  if (!match) return DEFAULT_HIGHLIGHT

  const hex = match[1]
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
    a: 255,
  }
}

const isPixelDifferent = (
  data1: Buffer,
  data2: Buffer,
  index: number,
  tolerance: number,
) => {
  return (
    Math.abs(data1[index] - data2[index]) > tolerance ||
    Math.abs(data1[index + 1] - data2[index + 1]) > tolerance ||
    Math.abs(data1[index + 2] - data2[index + 2]) > tolerance ||
    Math.abs(data1[index + 3] - data2[index + 3]) > tolerance
  )
}

const createPngDiff = async (
  reference: PNG,
  current: PNG,
  diffPath: string,
  tolerance: number,
  highlight: { r: number; g: number; b: number; a: number },
) => {
  const diff = new PNG({ width: reference.width, height: reference.height })

  for (let index = 0; index < reference.data.length; index += 4) {
    if (isPixelDifferent(reference.data, current.data, index, tolerance)) {
      diff.data[index] = highlight.r
      diff.data[index + 1] = highlight.g
      diff.data[index + 2] = highlight.b
      diff.data[index + 3] = highlight.a
    } else {
      diff.data[index] = current.data[index]
      diff.data[index + 1] = current.data[index + 1]
      diff.data[index + 2] = current.data[index + 2]
      diff.data[index + 3] = current.data[index + 3]
    }
  }

  await writeFile(diffPath, PNG.sync.write(diff))
}

const compare = async (
  buffer1: Buffer,
  buffer2: Buffer,
  tolerance: number,
): Promise<{ equal: boolean }> => {
  const reference = parsePng(buffer1)
  const current = parsePng(buffer2)

  let equal = false

  if (
    reference &&
    current &&
    reference.width === current.width &&
    reference.height === current.height
  ) {
    equal = true

    for (let index = 0; index < reference.data.length; index += 4) {
      if (isPixelDifferent(reference.data, current.data, index, tolerance)) {
        equal = false
        break
      }
    }
  } else {
    equal = buffer1.equals(buffer2)
  }

  return { equal }
}

const looksSameImpl = async (
  reference: ImageInput,
  current: ImageInput,
  options: LooksSameOptions = {},
) => {
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE
  const referenceBuffer = await getBuffer(reference)
  const currentBuffer = await getBuffer(current)

  return compare(referenceBuffer, currentBuffer, tolerance)
}

const createDiff = async ({
  reference,
  current,
  diff,
  highlightColor,
  tolerance,
}: CreateDiffOptions) => {
  const diffTolerance = tolerance ?? DEFAULT_TOLERANCE
  const referenceBuffer = await getBuffer(reference)
  const currentBuffer = await getBuffer(current)
  const referencePng = parsePng(referenceBuffer)
  const currentPng = parsePng(currentBuffer)

  if (
    diff.endsWith(".png") &&
    referencePng &&
    currentPng &&
    referencePng.width === currentPng.width &&
    referencePng.height === currentPng.height
  ) {
    const highlight = parseHexColor(highlightColor)
    await createPngDiff(
      referencePng,
      currentPng,
      diff,
      diffTolerance,
      highlight,
    )
    return
  }

  await writeFile(diff, currentBuffer)
}

type LooksSame = typeof looksSameImpl & {
  createDiff: typeof createDiff
}

const looksSame = Object.assign(looksSameImpl, { createDiff }) as LooksSame

export default looksSame
