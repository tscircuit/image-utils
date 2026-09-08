# @tscircuit/image-utils

Image parsing, comparison, and SVG geometry utilities that do not depend on
`sharp`.

## Image comparison

Import the PNG comparison API from the `looks-same` subpath:

```ts
import looksSame from "@tscircuit/image-utils/looks-same"

const result = await looksSame(referencePng, currentPng, {
  tolerance: 2,
})

const diffPng = await looksSame.createDiff({
  reference: referencePng,
  current: currentPng,
  highlightColor: "#ff00ff",
})
```

Inputs must be PNG bytes represented by an `ArrayBuffer` or `Uint8Array`.
`createDiff` returns the generated PNG bytes; callers are responsible for
writing them to disk when needed.

Set `percentThreshold` to allow a percentage of different pixels in `equal`:

```ts
const result = await looksSame(referencePng, currentPng, {
  percentThreshold: 0.5, // Allow up to 0.5% different pixels, inclusive.
})
```

The default is `0`, which requires no different pixels. The threshold applies
after the pixel comparison options (including `strict`, color tolerance and
ignored caret/antialiasing differences). It does not change the returned
`differentPixels` or `totalPixels`, or hide differences in `createDiff`.
Images with different dimensions use the same comparison canvas as the pixel
counts: the maximum width and maximum height of the two images. Pixels outside
their shared area count as different. Values must be finite and non-negative;
values of `100` or greater allow all pixel differences. Inputs that cannot be
decoded as PNG retain the byte-equality fallback, without a percentage threshold.

This package does not expose a `sharp` compatibility subpath. SVG inputs should
be rasterized to PNG before comparison when visual rather than byte equality is
required.
