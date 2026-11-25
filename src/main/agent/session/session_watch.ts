import { mkdirSync, watch } from 'node:fs';
import path from 'node:path';
import { sessionsRoot } from './session_sessions_root';

export function watchSessions(location: string, onChange: () => void): void {
	const root = sessionsRoot(location);
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
