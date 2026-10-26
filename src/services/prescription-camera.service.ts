import type { MediaResult } from '@capacitor/camera';

/** Strip image metadata and keep a readable page below the upload limit. */
export async function prescriptionCameraFile(photo: MediaResult): Promise<File> {
  if (!photo.webPath) throw new Error('CAMERA_IMAGE_UNAVAILABLE');
  const response = await fetch(photo.webPath);
  if (!response.ok) throw new Error('CAMERA_IMAGE_UNAVAILABLE');
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const scale = Math.min(1, 2200 / bitmap.width, 3000 / bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('CAMERA_IMAGE_UNAVAILABLE');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const encode = (quality: number) => new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('CAMERA_IMAGE_UNAVAILABLE')), 'image/jpeg', quality));
    let image = await encode(0.88);
    if (image.size > 9 * 1024 * 1024) image = await encode(0.76);
    if (image.size > 10 * 1024 * 1024) throw new Error('CAMERA_IMAGE_TOO_LARGE');
    return new File([image], `prescription-${Date.now()}.jpg`, { type: 'image/jpeg' });
  } finally {
    bitmap.close();
  }
}
