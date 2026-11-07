import * as colorDiff from "color-diff"
import { decode, encode } from "fast-png"

const DEFAULT_TOLERANCE = 2.3
const DEFAULT_HIGHLIGHT = { R: 255, G: 0, B: 255 }

type ImageInput = ArrayBuffer | Uint8Array

type RgbColor = {
  R: number
  G: number
  B: number
}

type LabColor = {
  L: number
  a: number
  b: number
}

type BaseOptions = {
  strict?: boolean
  tolerance?: number
  ignoreCaret?: boolean
  ignoreAntialiasing?: boolean
  antialiasingTolerance?: number
  pixelRatio?: number
  percentThreshold?: number
}

type LooksSameOptions = BaseOptions

type CreateDiffOptions = BaseOptions & {
  reference: ImageInput
  current: ImageInput
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

/**
 * Convert a 3-channel RGB byte array into a 4-channel RGBA byte array with opaque alpha.
 */
const expandRgbToRgba = (source: ArrayLike<number>, rgba: Uint8Array): void => {
  for (let i = 0, j = 0; i < source.length; i += 3, j += 4) {
    rgba[j] = source[i]!
    rgba[j + 1] = source[i + 1]!
    rgba[j + 2] = source[i + 2]!
    rgba[j + 3] = 255
  }
}

const parsePng = (bytes: Uint8Array): DecodedPng | null => {
  try {
    const png = decode(bytes)

    if (png.depth !== 8) return null

    const channels = png.channels
    const source = png.data
    const rgba = new Uint8Array(png.width * png.height * 4)

    if (channels === 4) {
      rgba.set(source as Uint8Array)
    } else if (channels === 3) {
      expandRgbToRgba(source, rgba)
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

const getImageBytes = async (input: ImageInput) => {
  if (input instanceof Uint8Array) return input
  return new Uint8Array(input)
}

const bytesEqual = (bytes1: Uint8Array, bytes2: Uint8Array) => {
  if (bytes1.byteLength !== bytes2.byteLength) return false

  for (let i = 0; i < bytes1.byteLength; i += 1) {
    if (bytes1[i] !== bytes2[i]) return false
  }

  return true
}

const parseHexColor = (color?: string): RgbColor => {
  if (!color) return DEFAULT_HIGHLIGHT
  const match = color.trim().match(/^#?([0-9a-fA-F]{6})$/)
  if (!match) return DEFAULT_HIGHLIGHT

  const hex = match[1]
  return {
    R: Number.parseInt(hex.slice(0, 2), 16),
    G: Number.parseInt(hex.slice(2, 4), 16),
    B: Number.parseInt(hex.slice(4, 6), 16),
  }
}

/**
 * Two-slot LAB color cache avoiding redundant RGB-to-LAB conversions on adjacent pixels.
 */
class LabColorPairCache {
  private rgb1: RgbColor | null = null
  private rgb2: RgbColor | null = null
  private lab1: LabColor | null = null
  private lab2: LabColor | null = null

  private findCached(color: RgbColor): LabColor | null {
    if (this.rgb1 && areColorsSame({ color1: color, color2: this.rgb1 })) {
      return this.lab1
    }
    if (this.rgb2 && areColorsSame({ color1: color, color2: this.rgb2 })) {
      return this.lab2
    }
    return null
  }

  resolvePair(color1: RgbColor, color2: RgbColor): { lab1: LabColor; lab2: LabColor } {
    let resolved1 = this.findCached(color1)
    let resolved2 = this.findCached(color2)

    if (!resolved1) {
      resolved1 = colorDiff.rgb_to_lab(color1)
      this.rgb1 = color1
      this.lab1 = resolved1
    }

    if (!resolved2) {
      resolved2 = colorDiff.rgb_to_lab(color2)
      this.rgb2 = color2
      this.lab2 = resolved2
    }

    return { lab1: resolved1, lab2: resolved2 }
  }
}

const computeCie76Distance = (lab1: LabColor, lab2: LabColor): number => {
  const dL = lab1.L - lab2.L
  const da = lab1.a - lab2.a
  const db = lab1.b - lab2.b
  return Math.sqrt(dL * dL + da * da + db * db)
}

const makeCIEDE2000Comparator = (tolerance: number): Comparator => {
  const upperBound = tolerance * 6.2
  const lowerBound = tolerance * 0.695
  const cache = new LabColorPairCache()

  return (data) => {
    if (areColorsSame(data)) {
      return true
    }

    const { lab1, lab2 } = cache.resolvePair(data.color1, data.color2)
    const cie76 = computeCie76Distance(lab1, lab2)

    if (cie76 >= upperBound) return false
    if (cie76 <= lowerBound) return true

    return colorDiff.diff(lab1, lab2) < tolerance
  }
}

interface AntialiasTarget {
  img1: DecodedPng
  x1: number
  y1: number
  data: PixelCompareInput
  img2?: DecodedPng
}

interface NeighborhoodAccumulator {
  exceededZeroes: boolean
  zeroes: number
  positives: number
  negatives: number
  min: number
  max: number
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const updateNeighborhoodAccumulator = (
  acc: NeighborhoodAccumulator,
  sample: { delta: number; x: number; y: number; brightnessTolerance: number },
): void => {
  const { delta, x, y, brightnessTolerance } = sample
  if (Math.abs(delta) <= brightnessTolerance) {
    acc.zeroes += 1
  } else if (delta > brightnessTolerance) {
    acc.positives += 1
  } else {
    acc.negatives += 1
  }

  if (acc.zeroes > 2) {
    acc.exceededZeroes = true
    return
  }

  if (delta < acc.min) {
    acc.min = delta
    acc.minX = x
    acc.minY = y
  }
  if (delta > acc.max) {
    acc.max = delta
    acc.maxX = x
    acc.maxY = y
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
      this._isAntialiased({
        img1: this._img2,
        x1: data.x,
        y1: data.y,
        data,
        img2: this._img1,
      }) ||
      this._isAntialiased({
        img1: this._img1,
        x1: data.x,
        y1: data.y,
        data,
        img2: this._img2,
      })
    )
  }

  private _scanNeighborhood(
    target: AntialiasTarget,
    brightnessTolerance: number,
  ): NeighborhoodAccumulator {
    const { img1, x1, y1, data } = target
    const color1 = img1.getPixel(x1, y1)
    const x0 = Math.max(x1 - 1, 0)
    const y0 = Math.max(y1 - 1, 0)
    const x2 = Math.min(x1 + 1, data.width - 1)
    const y2 = Math.min(y1 + 1, data.height - 1)

    const acc: NeighborhoodAccumulator = {
      exceededZeroes: false,
      zeroes: 0,
      positives: 0,
      negatives: 0,
      min: 0,
      max: 0,
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
    }

    for (let y = y0; y <= y2; y += 1) {
      for (let x = x0; x <= x2; x += 1) {
        if (x === x1 && y === y1) continue

        const delta = this._brightnessDelta(img1.getPixel(x, y), color1)
        updateNeighborhoodAccumulator(acc, {
          delta,
          x,
          y,
          brightnessTolerance,
        })
        if (acc.exceededZeroes) {
          return acc
        }
      }
    }

    return acc
  }

  private _isExtremeNeighborNonAntialiased(
    target: AntialiasTarget,
    neighborX: number,
    neighborY: number,
  ): boolean {
    const { img1, img2, data } = target
    return (
      !this._isAntialiased({ img1, x1: neighborX, y1: neighborY, data }) &&
      !this._isAntialiased({ img1: img2!, x1: neighborX, y1: neighborY, data })
    )
  }

  private _isAntialiased(target: AntialiasTarget): boolean {
    const checkExtremePixels = !target.img2
    const brightnessTolerance = checkExtremePixels
      ? this._brightnessTolerance
      : 0

    const scan = this._scanNeighborhood(target, brightnessTolerance)
    if (scan.exceededZeroes) return false
    if (checkExtremePixels) return true
    if (scan.negatives === 0 || scan.positives === 0) return false

    return (
      this._isExtremeNeighborNonAntialiased(target, scan.minX, scan.minY) ||
      this._isExtremeNeighborNonAntialiased(target, scan.maxX, scan.maxY)
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

  private _isInsideCaretBounds(data: PixelCompareInput): boolean {
    if (!this.caretTopLeft || !this.caretBottomRight) {
      return false
    }
    const withinX =
      data.x >= this.caretTopLeft.x && data.x <= this.caretBottomRight.x
    const withinY =
      data.y >= this.caretTopLeft.y && data.y <= this.caretBottomRight.y
    return withinX && withinY
  }

  private _checkIsCaret(data: PixelCompareInput) {
    if (this._state === "caretDetected") {
      return this._isInsideCaretBounds(data)
    }

    if (this._isInsideCaretBounds(data)) {
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
  percentThreshold?: number
}

type CompareResult = {
  equal: boolean
  differentPixels?: number
  totalPixels?: number
}

/**
 * Validate that a caller-supplied `percentThreshold` is a finite non-negative number.
 */
const isValidPercentThreshold = (threshold: number): boolean => {
  if (!Number.isFinite(threshold)) {
    return false
  }
  return threshold >= 0
}

/**
 * Evaluate whether the ratio of differing pixels to total pixels satisfies `percentThreshold`.
 */
const isWithinPercentThreshold = ({
  differentPixels,
  totalPixels,
  percentThreshold,
}: {
  differentPixels: number
  totalPixels: number
  percentThreshold?: number
}): boolean => {
  if (percentThreshold === undefined) {
    return differentPixels === 0
  }
  if (totalPixels === 0) {
    return differentPixels === 0
  }
  const diffPercent = (differentPixels / totalPixels) * 100
  return diffPercent <= percentThreshold
}

const prepareOptions = (options: BaseOptions = {}): PreparedOptions => {
  if (options.strict && options.tolerance !== undefined) {
    throw new TypeError(
      'Unable to use "strict" and "tolerance" options together',
    )
  }

  if (
    options.percentThreshold !== undefined &&
    !isValidPercentThreshold(options.percentThreshold)
  ) {
    throw new TypeError(
      'Expected "percentThreshold" to be a non-negative number',
    )
  }

  return {
    strict: Boolean(options.strict),
    tolerance: options.tolerance ?? DEFAULT_TOLERANCE,
    ignoreCaret: options.ignoreCaret ?? true,
    ignoreAntialiasing: options.ignoreAntialiasing ?? true,
    antialiasingTolerance: options.antialiasingTolerance ?? 0,
    pixelRatio: options.pixelRatio,
    percentThreshold: options.percentThreshold,
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

interface ImageGridContext {
  reference: DecodedPng
  current: DecodedPng
  comparator: Comparator
  width: number
  height: number
  minWidth: number
  minHeight: number
}

const buildGridContext = (
  reference: DecodedPng,
  current: DecodedPng,
  options: PreparedOptions,
): ImageGridContext => ({
  reference,
  current,
  comparator: createComparator(reference, current, options),
  width: Math.max(reference.width, current.width),
  height: Math.max(reference.height, current.height),
  minWidth: Math.min(reference.width, current.width),
  minHeight: Math.min(reference.height, current.height),
})

const isGridPixelEqual = (
  grid: ImageGridContext,
  coords: { x: number; y: number },
): boolean => {
  if (coords.x >= grid.minWidth || coords.y >= grid.minHeight) {
    return false
  }
  const color1 = grid.reference.getPixel(coords.x, coords.y)
  const color2 = grid.current.getPixel(coords.x, coords.y)
  return (
    areColorsSame({ color1, color2 }) ||
    grid.comparator({
      color1,
      color2,
      img1: grid.reference,
      img2: grid.current,
      x: coords.x,
      y: coords.y,
      width: grid.width,
      height: grid.height,
      minWidth: grid.minWidth,
      minHeight: grid.minHeight,
    })
  )
}

const writeRgbaPixel = (
  diffData: Uint8Array,
  index: number,
  color: RgbColor,
): void => {
  diffData[index] = color.R
  diffData[index + 1] = color.G
  diffData[index + 2] = color.B
  diffData[index + 3] = 255
}

const compare = async (
  buffer1: Uint8Array,
  buffer2: Uint8Array,
  options: PreparedOptions,
): Promise<CompareResult> => {
  const reference = parsePng(buffer1)
  const current = parsePng(buffer2)

  if (!reference || !current) {
    return { equal: bytesEqual(buffer1, buffer2) }
  }

  const grid = buildGridContext(reference, current, options)
  const totalPixels = grid.width * grid.height
  let differentPixels = 0

  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      if (!isGridPixelEqual(grid, { x, y })) {
        differentPixels += 1
      }
    }
  }

  return {
    equal: isWithinPercentThreshold({
      differentPixels,
      totalPixels,
      percentThreshold: options.percentThreshold,
    }),
    differentPixels,
    totalPixels,
  }
}

const looksSameImpl = async (
  reference: ImageInput,
  current: ImageInput,
  options: LooksSameOptions = {},
) => {
  const prepared = prepareOptions(options)
  const referenceBuffer = await getImageBytes(reference)
  const currentBuffer = await getImageBytes(current)

  return compare(referenceBuffer, currentBuffer, prepared)
}

const createDiff = async ({
  reference,
  current,
  highlightColor,
  ...options
}: CreateDiffOptions) => {
  const prepared = prepareOptions(options)
  const referenceBuffer = await getImageBytes(reference)
  const currentBuffer = await getImageBytes(current)
  const referencePng = parsePng(referenceBuffer)
  const currentPng = parsePng(currentBuffer)

  if (!(referencePng && currentPng)) {
    return currentBuffer
  }

  const grid = buildGridContext(referencePng, currentPng, prepared)
  const highlight = parseHexColor(highlightColor)
  const diffData = new Uint8Array(grid.width * grid.height * 4)

  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const index = (y * grid.width + x) * 4
      const pixelColor = isGridPixelEqual(grid, { x, y })
        ? referencePng.getPixel(x, y)
        : highlight
      writeRgbaPixel(diffData, index, pixelColor)
    }
  }

  return encode({
    width: grid.width,
    height: grid.height,
    data: diffData,
    channels: 4,
    depth: 8,
  })
}

type LooksSame = typeof looksSameImpl & {
  createDiff: typeof createDiff
}

const looksSame = Object.assign(looksSameImpl, { createDiff }) as LooksSame

export default looksSame
