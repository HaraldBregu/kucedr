import { app } from 'electron';

export function restart(): void {
	app.relaunch();
	app.quit();
}
