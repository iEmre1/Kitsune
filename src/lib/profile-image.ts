const MAX_INPUT_BYTES = 25 * 1024 * 1024;

type ProfileImageOptions = {
  maxWidth: number;
  maxHeight: number;
  maxBytes: number;
  fileName: string;
};

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Görsel işlenemedi."))),
      "image/webp",
      quality,
    );
  });
}

export async function prepareProfileImage(
  file: File,
  options: ProfileImageOptions,
): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Lütfen bir görsel dosyası seçin.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("Seçtiğiniz görsel 25 MB'dan küçük olmalıdır.");
  }

  const bitmap = await createImageBitmap(file);
  try {
    let scale = Math.min(
      1,
      options.maxWidth / bitmap.width,
      options.maxHeight / bitmap.height,
    );
    let quality = 0.82;
    let blob: Blob | null = null;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Görsel işlenemedi.");

      context.drawImage(bitmap, 0, 0, width, height);
      blob = await canvasToBlob(canvas, quality);
      if (blob.size <= options.maxBytes) break;

      if (quality > 0.52) quality -= 0.1;
      else scale *= 0.82;
    }

    if (!blob || blob.size > options.maxBytes) {
      throw new Error(
        `Görsel sıkıştırılamadı. En fazla ${Math.round(options.maxBytes / 1024 / 1024)} MB olmalıdır.`,
      );
    }

    return new File([blob], options.fileName, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}
