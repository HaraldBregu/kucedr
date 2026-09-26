export interface CoderLayout {
	readonly sidebarOpen: boolean;
	readonly viewerOpen: boolean;
	readonly sidebarWidth: number;
	readonly viewerWidth: number;
}

export function isCoderLayout(value: unknown): value is CoderLayout {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const layout = value as Partial<CoderLayout>;
	return (
		typeof layout.sidebarOpen === 'boolean' &&
		typeof layout.viewerOpen === 'boolean' &&
		typeof layout.sidebarWidth === 'number' &&
		Number.isFinite(layout.sidebarWidth) &&
		layout.sidebarWidth >= 100 &&
		layout.sidebarWidth <= 1000 &&
		typeof layout.viewerWidth === 'number' &&
		Number.isFinite(layout.viewerWidth) &&
		layout.viewerWidth >= 100 &&
		layout.viewerWidth <= 1000
	);
}
