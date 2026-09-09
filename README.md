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

This package does not expose a `sharp` compatibility subpath. SVG inputs should
be rasterized to PNG before comparison when visual rather than byte equality is
required.

## SVG fill geometry

`getSvgBRepShapes` classifies nested, nonintersecting path rings using the SVG
`nonzero` default or `evenodd`. It reads `fill-rule` presentation attributes and
simple inline declarations, including inheritance from ancestor elements. Each
path keeps its own fill rule; `getTransformedSvgPathRoutes` still returns a flat
list of routes.

Stylesheet selectors, overlapping/self-intersecting contour boolean operations,
and the existing centroid-based containment limitations are not resolved by this
fill-rule handling.
