import { app } from 'electron';
import { writeFileSync } from 'node:fs';

export function restart(): void {
	const request = process.env.KUCEDR_PRIVACY_RESTART_FILE;
	if (request) writeFileSync(request, '', { mode: 0o600 });
	else app.relaunch();
	app.quit();
}
