export class LinkBroker {
	private readonly queue: string[] = [];
	private listener?: (url: string) => Promise<void>;

	constructor(private readonly matches: (url: URL) => boolean) {}

	push(url: string): boolean {
		if (!this.accepts(url)) return false;
		if (this.listener) void this.listener(url);
		else this.queue.push(url);
		return true;
	}

	pushArguments(argumentsList: readonly string[]): boolean {
		const url = argumentsList.find((value) => this.accepts(value));
		return url ? this.push(url) : false;
	}

	subscribe(listener: (url: string) => Promise<void>): () => void {
		this.listener = listener;
		return () => {
			if (this.listener === listener) this.listener = undefined;
		};
	}

	async flush(): Promise<boolean> {
		if (!this.listener || this.queue.length === 0) return false;
		const pending = this.queue.splice(0);
		for (const url of pending) await this.listener(url);
		return true;
	}

	private accepts(value: string): boolean {
		if (value.length > 4096) return false;
		try {
			return this.matches(new URL(value));
		} catch {
			return false;
		}
	}
}

export const authLinks = new LinkBroker(
	(url) => url.protocol === 'kucedr:' && url.hostname === 'auth' && url.pathname === '/callback'
);
