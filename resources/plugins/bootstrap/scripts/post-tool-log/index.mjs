import { appendFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let data = '';
process.stdin.on('data', (chunk) => (data += chunk));
process.stdin.on('end', () => {
	const { settings, ...event } = JSON.parse(data);
	const root = path.resolve(settings.directory.replace(/^~(?=$|[/\\])/, os.homedir()));
	const day = new Date().toISOString().slice(0, 10);
	mkdirSync(root, { recursive: true });
	appendFileSync(
		path.join(root, `${event.event.toLowerCase().replaceAll('_', '-')}-${day}.jsonl`),
		`${JSON.stringify({ time: new Date().toISOString(), ...event })}\n`
	);
});
