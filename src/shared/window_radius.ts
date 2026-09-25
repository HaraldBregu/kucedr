export const WINDOW_RADII = [8, 12, 16, 20, 24] as const;

export type WindowRadius = (typeof WINDOW_RADII)[number];

export const DEFAULT_WINDOW_RADIUS: WindowRadius = 20;

export function isWindowRadius(value: unknown): value is WindowRadius {
	return WINDOW_RADII.some((radius) => radius === value);
}
