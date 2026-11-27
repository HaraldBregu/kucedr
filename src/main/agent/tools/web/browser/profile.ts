import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { webrtc } from '../../../../shield/webrtc';

export async function profile(): Promise<string> {
	const dir = await mkdtemp(path.join(tmpdir(), 'kucedr-browser-'));
	await mkdir(path.join(dir, 'Default'));
	await writeFile(
		path.join(dir, 'Default', 'Preferences'),
		JSON.stringify({ webrtc: { ip_handling_policy: webrtc(false) } })
	);
	return dir;
}
