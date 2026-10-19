export const MAX_PHOTO_BYTES = 800 * 1024;
const MAX_DIMENSION = 1600;
const INPUT_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

function encode(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo comprimir la foto.')), type, quality));
}

export async function resizeProjectPhoto(file) {
  if (!INPUT_TYPES.includes(file.type)) throw new Error('Selecciona una foto PNG, JPEG, GIF o WebP.');
  const url = URL.createObjectURL(file);
  const canvas = document.createElement('canvas');
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error(`No se puede abrir la imagen «${file.name}».`));
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('La foto no tiene dimensiones válidas.');
    const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    let width = Math.max(1, Math.round(image.naturalWidth * scale));
    let height = Math.max(1, Math.round(image.naturalHeight * scale));
    let type = 'image/webp';
    while (true) {
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No se pudo procesar la foto.');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      const draw = () => {
        context.clearRect(0, 0, width, height);
        if (type === 'image/jpeg') { context.fillStyle = '#fff'; context.fillRect(0, 0, width, height); }
        context.drawImage(image, 0, 0, width, height);
      };
      draw();
      for (const quality of [0.86, 0.72, 0.58, 0.44]) {
        let blob = await encode(canvas, type, quality);
        if (blob.type !== type) { type = 'image/jpeg'; draw(); blob = await encode(canvas, type, quality); }
        if (blob.size <= MAX_PHOTO_BYTES) {
          return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('No se pudo leer la foto comprimida.'));
            reader.readAsDataURL(blob);
          });
        }
      }
      if (width === 1 && height === 1) throw new Error('No se pudo reducir la foto a 800 KB.');
      width = Math.max(1, Math.floor(width * 0.75));
      height = Math.max(1, Math.floor(height * 0.75));
    }
  } finally {
    URL.revokeObjectURL(url);
    canvas.width = 0; canvas.height = 0;
  }
}
