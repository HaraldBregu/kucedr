import { app, dialog } from 'electron';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getPrivacy, getPrivacyRoute, isPrivacyEnabled, setPrivacy } from './state';

const CHILD_PARENT = 'KUCEDR_PRIVACY_PARENT';
const RESTART = 'KUCEDR_PRIVACY_RESTART_FILE';
const SANDBOX = '/usr/bin/sandbox-exec';

export function launchPrivacy(): boolean {
	if (!isPrivacyEnabled()) return false;

	const proxy = getPrivacyRoute();
	const isChild = process.env[CHILD_PARENT] === String(process.ppid) && Boolean(process.env[RESTART]);
	app.commandLine.appendSwitch('disable-background-networking');
	app.commandLine.appendSwitch('disable-quic');
	app.commandLine.appendSwitch('host-resolver-rules', 'MAP * ~NOTFOUND, EXCLUDE 127.0.0.1');
	app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'disable_non_proxied_udp');
	app.commandLine.appendSwitch('proxy-server', isChild && proxy ? proxy : 'socks5://127.0.0.1:0');
	app.commandLine.appendSwitch('proxy-bypass-list', '<-loopback>');
	if (isChild && getPrivacy().supported) return false;

	void app.whenReady().then(async () => {
		if (!getPrivacy().supported) {
			dialog.showErrorBox('Privacy Mode unavailable', 'Kucedr could not start the macOS network sandbox.');
			app.quit();
			return;
		}

		const profile = [
			'(version 1)',
			'(allow default)',
			'(deny network-outbound)',
			'(deny mach-lookup (global-name "com.apple.mDNSResponder") (global-name "com.apple.mDNSResponder.dnsproxy"))',
			proxy ? `(allow network-outbound (remote tcp "localhost:${new URL(proxy).port}"))` : '',
		].join('\n');
		const directory = mkdtempSync(path.join(os.tmpdir(), 'kucedr-privacy-'));
		const restartFile = path.join(directory, 'restart');
		const child = spawn(SANDBOX, ['-p', profile, process.execPath, ...process.argv.slice(1)], {
			env: { ...process.env, [CHILD_PARENT]: String(process.pid), [RESTART]: restartFile },
			stdio: 'inherit',
		});
		const started = Date.now();
		const code = await new Promise<number | null>((resolve) => {
			child.once('error', () => resolve(null));
			child.once('exit', resolve);
		});
		const restart = await import('node:fs').then(({ existsSync }) => existsSync(restartFile));
		rmSync(directory, { recursive: true, force: true });
		if (restart) app.relaunch();
		else if (code !== 0 && Date.now() - started < 15_000) {
			const result = await dialog.showMessageBox({
				type: 'error',
				title: 'Privacy Mode could not start',
				message: 'Kucedr could not start in the macOS network sandbox.',
				buttons: ['Quit', 'Turn Off Privacy Mode and Restart'],
				defaultId: 0,
				cancelId: 0,
			});
			if (result.response === 1) {
				setPrivacy(false);
				app.relaunch();
			}
		}
		app.quit();
	});
	return true;
}
