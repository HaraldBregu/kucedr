export interface BrowserPaneTab {
	readonly targetId: string;
	readonly chat: string;
	readonly url: string;
	readonly title: string;
	readonly loading: boolean;
	readonly order: number;
}

export interface BrowserPaneState {
	readonly tabs: readonly BrowserPaneTab[];
	readonly acting: readonly string[];
}

export interface BrowserPaneCommand {
	readonly targetId: string;
	readonly command: 'back' | 'forward' | 'reload' | 'stop' | 'navigate' | 'focus';
	readonly url?: string;
}

export interface BrowserPaneView {
	readonly targetId: string;
	readonly width: number;
	readonly height: number;
}

export type BrowserPaneInput = { readonly targetId: string } & (
	| {
			readonly type: 'move' | 'down' | 'up';
			readonly x: number;
			readonly y: number;
			readonly button: 'left' | 'middle' | 'right';
			readonly count: number;
	  }
	| {
			readonly type: 'wheel';
			readonly x: number;
			readonly y: number;
			readonly deltaX: number;
			readonly deltaY: number;
	  }
	| { readonly type: 'type' | 'paste'; readonly text: string }
	| { readonly type: 'press'; readonly key: string }
);

export interface BrowserPaneFrame {
	readonly targetId: string;
	readonly data: string;
	readonly width: number;
	readonly height: number;
}

export interface BrowserPaneApi {
	state(): Promise<BrowserPaneState>;
	command(request: BrowserPaneCommand): Promise<void>;
	view(request: BrowserPaneView | null): void;
	input(request: BrowserPaneInput): void;
	onChanged(callback: (state: BrowserPaneState) => void): () => void;
	onFrame(callback: (frame: BrowserPaneFrame) => void): () => void;
}
