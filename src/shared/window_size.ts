export const WINDOW_SIZES = {
	'900x700': { width: 900, height: 700 },
	'1000x700': { width: 1000, height: 700 },
	'1200x800': { width: 1200, height: 800 },
} as const;

export type WindowSize = keyof typeof WINDOW_SIZES;
