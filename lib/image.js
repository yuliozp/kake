// Reduce una foto del teléfono a un JPEG liviano antes de enviarla.
// Evita pedidos que fallan por fotos de varios MB.
export function fileToDataUrl(file, max = 1000, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file.type?.startsWith("image/")) return reject(new Error("not-image"));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read-failed"));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("decode-failed"));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
