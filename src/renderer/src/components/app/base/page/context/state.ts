export type SidebarSide = 'left' | 'right';

export const DEFAULT_SIDEBAR_WIDTH = 224;
export const MIN_SIDEBAR_WIDTH = 208;
export const MAX_SIDEBAR_WIDTH = 384;

export interface PageState {
	readonly isSidebarVisible: boolean;
	readonly sidebarSide: SidebarSide;
	readonly isHeaderVisible: boolean;
	readonly sidebarOpen: boolean;
	readonly sidebarOpenMobile: boolean;
}

export const INITIAL_PAGE_STATE: PageState = {
	isSidebarVisible: true,
	sidebarSide: 'left',
	isHeaderVisible: true,
	sidebarOpen: true,
	sidebarOpenMobile: false,
};
