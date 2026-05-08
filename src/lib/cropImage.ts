import type { Area } from "react-easy-crop";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (e) => reject(e));
    img.setAttribute("crossOrigin", "anonymous");
    img.src = src;
  });
}

/** Recorta a região indicada e exporta PNG (com limite de lado para não gerar ficheiros enormes). */
export async function getCroppedPngBlob(imageSrc: string, pixelCrop: Area, maxSide = 512): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const { x, y, width, height } = pixelCrop;
  const scale = Math.min(1, maxSide / width, maxSide / height);
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D não disponível");

  ctx.drawImage(image, x, y, width, height, 0, 0, outW, outH);

  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Falha ao gerar imagem"));
      },
      "image/png",
      0.92,
    );
  });
}
