import { readFile, writeFile } from "node:fs/promises"
import * as colorDiff from "color-diff"
import { decode, encode } from "fast-png"

const DEFAULT_TOLERANCE = 2.3
const DEFAULT_HIGHLIGHT = { R: 255, G: 0, B: 255 }

type ImageInput = Buffer | string

type RgbColor = {
  R: number
  G: number
  B: number
}

type BaseOptions = {
  strict?: boolean
  tolerance?: number
  ignoreCaret?: boolean
  ignoreAntialiasing?: boolean
  antialiasingTolerance?: number
  pixelRatio?: number
}

type LooksSameOptions = BaseOptions

type CreateDiffOptions = BaseOptions & {
  reference: ImageInput
  current: ImageInput
  diff: string
  highlightColor?: string
}

type DecodedPng = {
  width: number
  height: number
  data: Uint8Array
  getPixel: (x: number, y: number) => RgbColor
}

type PixelCompareInput = {
  color1: RgbColor
  color2: RgbColor
  img1: DecodedPng
  img2: DecodedPng
  x: number
  y: number
  width: number
  height: number
  minWidth: number
  minHeight: number
}

type Comparator = (data: PixelCompareInput) => boolean

const areColorsSame = ({
  color1,
  color2,
}: {
  color1: RgbColor
  color2: RgbColor
}) => {
  return color1.R === color2.R && color1.G === color2.G && color1.B === color2.B
}

const parsePng = (buffer: Buffer): DecodedPng | null => {
  try {
    const png = decode(buffer)

    if (png.depth !== 8) return null

    const channels = png.channels
    const source = png.data
    const rgba = new Uint8Array(png.width * png.height * 4)

    if (channels === 4) {
      rgba.set(source as Uint8Array)
    } else if (channels === 3) {
      for (let i = 0, j = 0; i < source.length; i += 3, j += 4) {
        rgba[j] = source[i]!
        rgba[j + 1] = source[i + 1]!
        rgba[j + 2] = source[i + 2]!
        rgba[j + 3] = 255
      }
    } else {
      return null
    }

    return {
      width: png.width,
      height: png.height,
      data: rgba,
      getPixel: (x, y) => {
        const index = (y * png.width + x) * 4
        return {
          R: rgba[index]!,
          G: rgba[index + 1]!,
          B: rgba[index + 2]!,
        }
      },
    }
  } catch {
    return null
  }
}

const getBuffer = async (input: ImageInput) => {
  if (Buffer.isBuffer(input)) return input
  return readFile(input)
}

const parseHexColor = (color?: string): RgbColor => {
  if (!color) return DEFAULT_HIGHLIGHT
  const match = /^#?([0-9a-fA-F]{6})$/.exec(color.trim())
  if (!match) return DEFAULT_HIGHLIGHT

  const hex = match[1]
  return {
    R: Number.parseInt(hex.slice(0, 2), 16),
    G: Number.parseInt(hex.slice(2, 4), 16),
    B: Number.parseInt(hex.slice(4, 6), 16),
  }
}

const makeCIEDE2000Comparator = (tolerance: number): Comparator => {
  const upperBound = tolerance * 6.2
  const lowerBound = tolerance * 0.695

  let rgbColor1: RgbColor | null = null
  let rgbColor2: RgbColor | null = null
  let labColor1: { L: number; a: number; b: number } | null = null
  let labColor2: { L: number; a: number; b: number } | null = null

  return (data) => {
    if (areColorsSame(data)) {
      return true
    }

    let lab1 = null
    let lab2 = null

    if (
      rgbColor1 &&
      areColorsSame({ color1: data.color1, color2: rgbColor1 })
    ) {
      lab1 = labColor1
    } else if (
      rgbColor2 &&
      areColorsSame({ color1: data.color1, color2: rgbColor2 })
    ) {
      lab1 = labColor2
    }

    if (
      rgbColor1 &&
      areColorsSame({ color1: data.color2, color2: rgbColor1 })
    ) {
      lab2 = labColor1
    } else if (
      rgbColor2 &&
      areColorsSame({ color1: data.color2, color2: rgbColor2 })
    ) {
      lab2 = labColor2
    }

    if (!lab1) {
      lab1 = colorDiff.rgb_to_lab(data.color1)
      rgbColor1 = data.color1
      labColor1 = lab1
    }

    if (!lab2) {
      lab2 = colorDiff.rgb_to_lab(data.color2)
      rgbColor2 = data.color2
      labColor2 = lab2
    }

    const cie76 = Math.sqrt(
      (lab1.L - lab2.L) * (lab1.L - lab2.L) +
        (lab1.a - lab2.a) * (lab1.a - lab2.a) +
        (lab1.b - lab2.b) * (lab1.b - lab2.b),
    )

    if (cie76 >= upperBound) return false
    if (cie76 <= lowerBound) return true

    return colorDiff.diff(lab1, lab2) < tolerance
  }
}

class AntialiasingComparator {
  private _baseComparator: Comparator
  private _img1: DecodedPng
  private _img2: DecodedPng
  private _brightnessTolerance: number

  constructor(
    baseComparator: Comparator,
    img1: DecodedPng,
    img2: DecodedPng,
    { antialiasingTolerance = 0 }: PreparedOptions,
  ) {
    this._baseComparator = baseComparator
    this._img1 = img1
    this._img2 = img2
    this._brightnessTolerance = antialiasingTolerance
  }

  compare(data: PixelCompareInput) {
    return this._baseComparator(data) || this._checkIsAntialiased(data)
  }

  private _checkIsAntialiased(data: PixelCompareInput) {
    return (
      this._isAntialiased(this._img2, data.x, data.y, data, this._img1) ||
      this._isAntialiased(this._img1, data.x, data.y, data, this._img2)
    )
  }

  private _isAntialiased(
    img1: DecodedPng,
    x1: number,
    y1: number,
    data: PixelCompareInput,
    img2?: DecodedPng,
  ): boolean {
    const color1 = img1.getPixel(x1, y1)
    const x0 = Math.max(x1 - 1, 0)
    const y0 = Math.max(y1 - 1, 0)
    const x2 = Math.min(x1 + 1, data.width - 1)
    const y2 = Math.min(y1 + 1, data.height - 1)

    const checkExtremePixels = !img2
    const brightnessTolerance = checkExtremePixels
      ? this._brightnessTolerance
      : 0

    let zeroes = 0
    let positives = 0
    let negatives = 0
    let min = 0
    let max = 0
    let minX = 0
    let minY = 0
    let maxX = 0
    let maxY = 0

    for (let y = y0; y <= y2; y += 1) {
      for (let x = x0; x <= x2; x += 1) {
        if (x === x1 && y === y1) continue

        const delta = this._brightnessDelta(img1.getPixel(x, y), color1)

        if (Math.abs(delta) <= brightnessTolerance) {
          zeroes += 1
        } else if (delta > brightnessTolerance) {
          positives += 1
        } else {
          negatives += 1
        }

        if (zeroes > 2) return false
        if (checkExtremePixels) continue

        if (delta < min) {
          min = delta
          minX = x
          minY = y
        }

        if (delta > max) {
          max = delta
          maxX = x
          maxY = y
        }
      }
    }

    if (checkExtremePixels) return true
    if (negatives === 0 || positives === 0) return false

    return (
      (!this._isAntialiased(img1, minX, minY, data) &&
        !this._isAntialiased(img2!, minX, minY, data)) ||
      (!this._isAntialiased(img1, maxX, maxY, data) &&
        !this._isAntialiased(img2!, maxX, maxY, data))
    )
  }

  private _brightnessDelta(color1: RgbColor, color2: RgbColor) {
    return (
      color1.R * 0.29889531 +
      color1.G * 0.58662247 +
      color1.B * 0.11448223 -
      (color2.R * 0.29889531 + color2.G * 0.58662247 + color2.B * 0.11448223)
    )
  }
}

class IgnoreCaretComparator {
  private pixelRatio: number
  private caretTopLeft: { x: number; y: number } | null = null
  private caretBottomRight: { x: number; y: number } | null = null
  private _baseComparator: Comparator
  private _state: "init" | "caretDetected" = "init"

  constructor(baseComparator: Comparator, pixelRatio?: number) {
    this.pixelRatio = pixelRatio ? Math.floor(pixelRatio) : 1
    this._baseComparator = baseComparator
  }

  compare(data: PixelCompareInput) {
    return this._baseComparator(data) || this._checkIsCaret(data)
  }

  private _checkIsCaret(data: PixelCompareInput) {
    if (this._state === "caretDetected") {
      return (
        this.caretTopLeft !== null &&
        this.caretBottomRight !== null &&
        data.x >= this.caretTopLeft.x &&
        data.x <= this.caretBottomRight.x &&
        data.y >= this.caretTopLeft.y &&
        data.y <= this.caretBottomRight.y
      )
    }

    if (
      this.caretTopLeft &&
      this.caretBottomRight &&
      data.x >= this.caretTopLeft.x &&
      data.x <= this.caretBottomRight.x &&
      data.y >= this.caretTopLeft.y &&
      data.y <= this.caretBottomRight.y
    ) {
      return true
    }

    const lastCaretPoint = this._getLastCaretPoint(data)

    if (!this._looksLikeCaret({ x: data.x, y: data.y }, lastCaretPoint)) {
      return false
    }

    this.caretTopLeft = { x: data.x, y: data.y }
    this.caretBottomRight = lastCaretPoint
    this._state = "caretDetected"

    return true
  }

  private _getLastCaretPoint(data: PixelCompareInput) {
    let currPoint = { x: data.x, y: data.y }

    while (true) {
      const nextPoint = this._getNextCaretPoint(
        { x: data.x, y: data.y },
        currPoint,
      )

      if (
        this._isPointOutsideImages(nextPoint, data) ||
        this._areColorsSame(nextPoint, data)
      ) {
        return currPoint
      }

      currPoint = nextPoint
    }
  }

  private _isPointOutsideImages(
    point: { x: number; y: number },
    data: PixelCompareInput,
  ) {
    return point.x >= data.minWidth || point.y >= data.minHeight
  }

  private _areColorsSame(
    point: { x: number; y: number },
    data: PixelCompareInput,
  ) {
    const color1 = data.img1.getPixel(point.x, point.y)
    const color2 = data.img2.getPixel(point.x, point.y)
    return areColorsSame({ color1, color2 })
  }

  private _getNextCaretPoint(
    firstCaretPoint: { x: number; y: number },
    currPoint: { x: number; y: number },
  ) {
    const nextX = currPoint.x + 1

    return nextX < firstCaretPoint.x + this.pixelRatio
      ? { x: nextX, y: currPoint.y }
      : { x: firstCaretPoint.x, y: currPoint.y + 1 }
  }

  private _looksLikeCaret(
    firstCaretPoint: { x: number; y: number },
    lastCaretPoint: { x: number; y: number },
  ) {
    return (
      this._caretHeight(firstCaretPoint, lastCaretPoint) > 1 &&
      this._caretWidth(firstCaretPoint, lastCaretPoint) === this.pixelRatio
    )
  }

  private _caretHeight(
    firstCaretPoint: { x: number; y: number },
    lastCaretPoint: { x: number; y: number },
  ) {
    return lastCaretPoint.y - firstCaretPoint.y + 1
  }

  private _caretWidth(
    firstCaretPoint: { x: number; y: number },
    lastCaretPoint: { x: number; y: number },
  ) {
    return lastCaretPoint.x - firstCaretPoint.x + 1
  }
}

type PreparedOptions = {
  strict: boolean
  tolerance: number
  ignoreCaret: boolean
  ignoreAntialiasing: boolean
  antialiasingTolerance: number
  pixelRatio?: number
}

const prepareOptions = (options: BaseOptions = {}): PreparedOptions => {
  if (options.strict && options.tolerance !== undefined) {
    throw new TypeError(
      'Unable to use "strict" and "tolerance" options together',
    )
  }

  return {
    strict: Boolean(options.strict),
    tolerance: options.tolerance ?? DEFAULT_TOLERANCE,
    ignoreCaret: options.ignoreCaret ?? true,
    ignoreAntialiasing: options.ignoreAntialiasing ?? true,
    antialiasingTolerance: options.antialiasingTolerance ?? 0,
    pixelRatio: options.pixelRatio,
  }
}

const createComparator = (
  img1: DecodedPng,
  img2: DecodedPng,
  options: PreparedOptions,
): Comparator => {
  let comparator: Comparator = options.strict
    ? (data) => areColorsSame(data)
    : makeCIEDE2000Comparator(options.tolerance)

  if (options.ignoreAntialiasing) {
    const antialiasingComparator = new AntialiasingComparator(
      comparator,
      img1,
      img2,
      options,
    )
    comparator = (data) => antialiasingComparator.compare(data)
  }

  if (options.ignoreCaret) {
    const caretComparator = new IgnoreCaretComparator(
      comparator,
      options.pixelRatio,
    )
    comparator = (data) => caretComparator.compare(data)
  }

  return comparator
}

const compare = async (
  buffer1: Buffer,
  buffer2: Buffer,
  options: PreparedOptions,
): Promise<{ equal: boolean }> => {
  const reference = parsePng(buffer1)
  const current = parsePng(buffer2)

  if (!reference || !current) {
    return { equal: buffer1.equals(buffer2) }
  }

  if (
    reference.width !== current.width ||
    reference.height !== current.height
  ) {
    return { equal: false }
  }

  const comparator = createComparator(reference, current, options)
  const width = reference.width
  const height = reference.height

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color1 = reference.getPixel(x, y)
      const color2 = current.getPixel(x, y)
      const same =
        areColorsSame({ color1, color2 }) ||
        comparator({
          color1,
          color2,
          img1: reference,
          img2: current,
          x,
          y,
          width,
          height,
          minWidth: width,
          minHeight: height,
        })

      if (!same) {
        return { equal: false }
      }
    }
  }

  return { equal: true }
}

const looksSameImpl = async (
  reference: ImageInput,
  current: ImageInput,
  options: LooksSameOptions = {},
) => {
  const prepared = prepareOptions(options)
  const referenceBuffer = await getBuffer(reference)
  const currentBuffer = await getBuffer(current)

  return compare(referenceBuffer, currentBuffer, prepared)
}

const createDiff = async ({
  reference,
  current,
  diff,
  highlightColor,
  ...options
}: CreateDiffOptions) => {
  const prepared = prepareOptions(options)
  const referenceBuffer = await getBuffer(reference)
  const currentBuffer = await getBuffer(current)
  const referencePng = parsePng(referenceBuffer)
  const currentPng = parsePng(currentBuffer)

  if (!(diff.endsWith(".png") && referencePng && currentPng)) {
    await writeFile(diff, currentBuffer)
    return
  }

  const comparator = createComparator(referencePng, currentPng, prepared)
  const width = Math.max(referencePng.width, currentPng.width)
  const height = Math.max(referencePng.height, currentPng.height)
  const minWidth = Math.min(referencePng.width, currentPng.width)
  const minHeight = Math.min(referencePng.height, currentPng.height)
  const highlight = parseHexColor(highlightColor)
  const diffData = new Uint8Array(width * height * 4)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4

      if (x >= minWidth || y >= minHeight) {
        diffData[index] = highlight.R
        diffData[index + 1] = highlight.G
        diffData[index + 2] = highlight.B
        diffData[index + 3] = 255
        continue
      }

      const color1 = referencePng.getPixel(x, y)
      const color2 = currentPng.getPixel(x, y)
      const same =
        areColorsSame({ color1, color2 }) ||
        comparator({
          color1,
          color2,
          img1: referencePng,
          img2: currentPng,
          x,
          y,
          width,
          height,
          minWidth,
          minHeight,
        })

      if (same) {
        diffData[index] = color1.R
        diffData[index + 1] = color1.G
        diffData[index + 2] = color1.B
        diffData[index + 3] = 255
      } else {
        diffData[index] = highlight.R
        diffData[index + 1] = highlight.G
        diffData[index + 2] = highlight.B
        diffData[index + 3] = 255
      }
    }
  }

  const encoded = encode({
    width,
    height,
    data: diffData,
    channels: 4,
    depth: 8,
  })
  await writeFile(diff, Buffer.from(encoded))
}

type LooksSame = typeof looksSameImpl & {
  createDiff: typeof createDiff
}

const looksSame = Object.assign(looksSameImpl, { createDiff }) as LooksSame

export default looksSame
