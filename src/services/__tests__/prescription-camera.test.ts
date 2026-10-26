import { afterEach, describe, expect, it, vi } from 'vitest';
import { prescriptionCameraFile } from '../prescription-camera.service';

describe('prescription camera file', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('resizes a captured page and uploads a JPEG without source metadata', async () => {
    const close = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob(['raw-camera-image']) })));
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 4400, height: 6000, close })));
    const drawImage = vi.fn();
    const canvas = document.createElement('canvas');
    vi.spyOn(document, 'createElement').mockReturnValueOnce(canvas);
    vi.spyOn(canvas, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    vi.spyOn(canvas, 'toBlob').mockImplementation((callback) => callback(new Blob(['encoded-image'], { type: 'image/jpeg' })));

    const file = await prescriptionCameraFile({ webPath: 'capacitor://private/photo', saved: false } as any);

    expect(file.type).toBe('image/jpeg');
    expect(file.name).toMatch(/^prescription-\d+\.jpg$/);
    expect(await file.text()).toBe('encoded-image');
    expect(canvas.width).toBe(2200);
    expect(canvas.height).toBe(3000);
    expect(drawImage).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });
});
