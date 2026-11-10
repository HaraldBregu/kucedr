import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { directory } = JSON.parse(readFileSync('config.json', 'utf8'));
const root = path.resolve(directory.replace(/^~(?=$|[/\\])/, os.homedir()));

let data = '';
process.stdin.on('data', (chunk) => (data += chunk));
process.stdin.on('end', () => {
	const event = JSON.parse(data);
	const day = new Date().toISOString().slice(0, 10);
	mkdirSync(root, { recursive: true });
	appendFileSync(
		path.join(root, `${event.event.toLowerCase().replaceAll('_', '-')}-${day}.jsonl`),
		`${JSON.stringify({ time: new Date().toISOString(), ...event })}\n`
	);
});
