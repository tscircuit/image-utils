import { test, expect } from "bun:test"
import { loadImageSource } from "lib/svg-to-brep-shapes"
import http from "node:http"

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>`

test("loadImageSource normalizes uppercase SVG Content-Type", async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "IMAGE/SVG+XML" })
    res.end(SVG)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const port = (server.address() as { port: number }).port

  const result = await loadImageSource(`http://127.0.0.1:${port}/image.svg`)
  expect(result.mimetype).toBe("image/svg+xml")
  expect(result.text).toBe(SVG)

  server.close()
})

test("loadImageSource normalizes uppercase octet-stream and falls back to path", async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "APPLICATION/OCTET-STREAM" })
    res.end(SVG)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const port = (server.address() as { port: number }).port

  const result = await loadImageSource(`http://127.0.0.1:${port}/image.svg`)
  expect(result.mimetype).toBe("image/svg+xml")
  expect(result.text).toBe(SVG)

  server.close()
})

test("loadImageSource normalizes uppercase MIME in inline data URLs", async () => {
  const result = await loadImageSource(
    `data:IMAGE/SVG+XML;utf8,${encodeURIComponent(SVG)}`,
  )
  expect(result.mimetype).toBe("image/svg+xml")
  expect(result.text).toBe(SVG)
})
