import { Resvg } from "@resvg/resvg-js"

export const convertSvgToPng = (svg: string): Buffer => {
  const resvg = new Resvg(svg)
  return Buffer.from(resvg.render().asPng())
}
