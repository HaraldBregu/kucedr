import { mkdirSync, watch } from 'node:fs';
import path from 'node:path';

export function watchSessions(root: string, onChange: () => void): void {
	let timer: NodeJS.Timeout | undefined;
	mkdirSync(root, { recursive: true });
	try {
		watch(root, { recursive: true }, (_event, file) => {
			if (file && path.basename(file) === 'run.jsonl') return;
			clearTimeout(timer);
			timer = setTimeout(onChange, 300);
		});
	} catch {
		void 0;
	}
}
