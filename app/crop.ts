export type CropSourceRect = { sx: number; sy: number; sw: number; sh: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getCropSourceRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  zoom = 1,
  positionX = 50,
  positionY = 50,
): CropSourceRect {
  if ([sourceWidth, sourceHeight, targetWidth, targetHeight].some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("裁剪尺寸无效");
  }

  const safeZoom = clamp(Number.isFinite(zoom) ? zoom : 1, 1, 4);
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  let baseWidth = sourceWidth;
  let baseHeight = sourceHeight;

  if (sourceRatio > targetRatio) baseWidth = sourceHeight * targetRatio;
  else baseHeight = sourceWidth / targetRatio;

  const sw = baseWidth / safeZoom;
  const sh = baseHeight / safeZoom;
  const sx = (sourceWidth - sw) * (clamp(positionX, 0, 100) / 100);
  const sy = (sourceHeight - sh) * (clamp(positionY, 0, 100) / 100);
  return { sx, sy, sw, sh };
}
