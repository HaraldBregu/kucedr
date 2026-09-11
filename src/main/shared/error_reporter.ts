import { app } from 'electron';
import type { LoggerService } from './index';

let safetyNetLogger: LoggerService | null = null;
let safetyNetInstalled = false;

export function setupProcessSafetyNet(logger?: LoggerService): void {
	if (logger) {
		safetyNetLogger = logger;
	}
	if (safetyNetInstalled) {
		return;
	}
	safetyNetInstalled = true;
	let terminationRequested = false;
	const requestTermination = (): void => {
		if (terminationRequested) {
			app.exit(1);
			return;
		}
		terminationRequested = true;
		process.exitCode = 1;
		if (app.isReady()) app.quit();
		else app.once('ready', () => app.quit());
	};

	process.on('uncaughtException', (error, origin) => {
		const message = error instanceof Error ? error.stack || error.message : String(error);
		safetyNetLogger?.error('Process', `uncaughtException (${origin})`, { error: message });
		console.error(`[uncaughtException:${origin}]`, message);
		requestTermination();
	});

	process.on('unhandledRejection', (reason) => {
		const message = reason instanceof Error ? reason.stack || reason.message : String(reason);
		safetyNetLogger?.error('Process', 'unhandledRejection', { reason: message });
		console.error('[unhandledRejection]', message);
		requestTermination();
	});

	process.on('exit', (code) => {
		if (code === 0) return;
		const stack = new Error('exit trace').stack;
		safetyNetLogger?.warn('Process', `process.exit(${code})`, { stack });
		console.error(`[process.exit] code=${code}`, stack);
	});

	for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT'] as const) {
		process.on(signal, () => {
			safetyNetLogger?.warn('Process', `Received ${signal}`);
			console.error(`[signal] ${signal}`);
			requestTermination();
		});
	}
}

export function setupEventLogging(logger: LoggerService): void {
	app.on('ready', () => {
		logger.info('App', 'Application ready', {
			version: app.getVersion(),
			platform: process.platform,
			arch: process.arch,
			electron: process.versions.electron,
			chrome: process.versions.chrome,
			node: process.versions.node,
		});
	});

	app.on('browser-window-created', (_event, window) => {
		logger.debug('App', `Browser window created: ID ${window.id}`);

		window.on('ready-to-show', () => {
			logger.debug('Window', `Window ready to show: ID ${window.id}`);
		});

		window.on('show', () => {
			logger.debug('Window', `Window shown: ID ${window.id}`);
		});

		window.on('hide', () => {
			logger.debug('Window', `Window hidden: ID ${window.id}`);
		});

		window.on('focus', () => {
			logger.debug('Window', `Window focused: ID ${window.id}`);
		});

		window.on('blur', () => {
			logger.debug('Window', `Window blurred: ID ${window.id}`);
		});

		window.on('maximize', () => {
			logger.debug('Window', `Window maximized: ID ${window.id}`);
		});

		window.on('unmaximize', () => {
			logger.debug('Window', `Window unmaximized: ID ${window.id}`);
		});

		window.on('minimize', () => {
			logger.debug('Window', `Window minimized: ID ${window.id}`);
		});

		window.on('restore', () => {
			logger.debug('Window', `Window restored: ID ${window.id}`);
		});

		window.on('close', () => {
			logger.debug('Window', `Window closing: ID ${window.id}`);
		});

		window.on('closed', () => {
			logger.debug('Window', `Window closed: ID ${window.id}`);
		});

		window.webContents.on('did-finish-load', () => {
			logger.debug('WebContents', `Page loaded: Window ID ${window.id}`);
		});

		window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
			logger.error('WebContents', `Page failed to load: ${validatedURL}`, {
				windowId: window.id,
				errorCode,
				errorDescription,
			});
		});

		window.webContents.on('render-process-gone', (_event, details) => {
			logger.error('WebContents', `Renderer process gone: Window ID ${window.id}`, {
				reason: details.reason,
				exitCode: details.exitCode,
			});
		});

		window.webContents.on('unresponsive', () => {
			logger.warn('WebContents', `Renderer process unresponsive: Window ID ${window.id}`);
		});

		window.webContents.on('responsive', () => {
			logger.info('WebContents', `Renderer process responsive again: Window ID ${window.id}`);
		});
	});

	app.on('browser-window-focus', (_event, window) => {
		logger.debug('App', `Browser window focused: ID ${window.id}`);
	});

	app.on('browser-window-blur', (_event, window) => {
		logger.debug('App', `Browser window blurred: ID ${window.id}`);
	});

	app.on('child-process-gone', (_event, details) => {
		logger.error('App', 'Child process gone', {
			type: details.type,
			reason: details.reason,
			exitCode: details.exitCode,
		});
	});

	app.on('certificate-error', (_event, _webContents, url, error, certificate) => {
		logger.error('App', 'Certificate error', {
			url,
			error,
			issuer: certificate.issuerName,
		});
	});

	app.on('web-contents-created', (_event, webContents) => {
		logger.debug('App', `WebContents created: ID ${webContents.id}`);
	});

	app.on('accessibility-support-changed', (_event, accessibilitySupportEnabled) => {
		logger.info(
			'App',
			`Accessibility support: ${accessibilitySupportEnabled ? 'enabled' : 'disabled'}`
		);
	});
}
