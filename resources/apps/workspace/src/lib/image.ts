export async function copyImage(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error("Unable to read image")
  const bitmap = await createImageBitmap(await response.blob())
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Unable to prepare image")
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  const image = await canvas.convertToBlob({ type: "image/png" })
  await navigator.clipboard.write([new ClipboardItem({ "image/png": image })])
}
