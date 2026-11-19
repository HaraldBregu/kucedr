import { app, screen, type WebContents } from 'electron';
import { z } from 'zod';
import { BrowserChannels } from '../../shared/ipc_channels_definitions';
import { cast } from '../agent/tools/web/browser/cast';
import { command } from '../agent/tools/web/browser/command';
import { fit } from '../agent/tools/web/browser/fit';
import { input } from '../agent/tools/web/browser/input';
import { pane, paneEvents } from '../agent/tools/web/browser/pane';
import { interactive } from '../agent/tools/web/browser/session';
import { tabs } from '../agent/tools/web/browser/tabs';
import type { AppRegistry } from '../apps/app_registry';
import type { EventBus } from '../event_bus';
import type { WindowContextManager } from '../window_context';
import type { IpcModule } from './core/module';
import { TrustedRenderer } from './core/trusted';

const targetId = z.string().regex(/^t\d+$/);
const coordinate = z.number().min(0).max(16_384);
const commandSchema = z.object({
	targetId,
	command: z.enum(['back', 'forward', 'reload', 'stop', 'navigate', 'focus']),
	url: z.string().max(4096).optional(),
});
const viewSchema = z
	.object({
		targetId,
		width: z.number().int().min(1).max(8192),
		height: z.number().int().min(1).max(8192),
	})
	.nullable();
const inputSchema = z.discriminatedUnion('type', [
	z.object({
		targetId,
		type: z.enum(['move', 'down', 'up']),
		x: coordinate,
		y: coordinate,
		button: z.enum(['left', 'middle', 'right']),
		count: z.number().int().min(0).max(3),
	}),
	z.object({
		targetId,
		type: z.literal('wheel'),
		x: coordinate,
		y: coordinate,
		deltaX: z.number().finite(),
		deltaY: z.number().finite(),
	}),
	z.object({ targetId, type: z.enum(['type', 'paste']), text: z.string().max(1_000_000) }),
	z.object({ targetId, type: z.literal('press'), key: z.string().max(64) }),
]);

export interface BrowserIpcDeps {
	windows: WindowContextManager;
	apps: AppRegistry;
}

export class BrowserIpc implements IpcModule<BrowserIpcDeps> {
	readonly name = 'browser';

	register({ windows, apps }: BrowserIpcDeps, _eventBus: EventBus): void {
		const trusted = new TrustedRenderer(windows, apps);
		const viewers = new Map<WebContents, () => void>();
		let revision = 0;
		let inputs = Promise.resolve();
		let views = Promise.resolve();

		void app.whenReady().then(() => {
			pane.scale = screen.getPrimaryDisplay().scaleFactor;
		});
		paneEvents.on('change', () => {
			const current = ++revision;
			void tabs().then((state) => {
				if (current === revision) trusted.broadcast(BrowserChannels.changed, state);
			});
		});

		trusted.query(BrowserChannels.state, () => tabs());
		trusted.command(BrowserChannels.command, (request) => command(commandSchema.parse(request)));
		trusted.commandWithEvent(BrowserChannels.view, ({ sender }, request) => {
			const next = viewSchema.parse(request);
			views = views
				.then(async () => {
					viewers.get(sender)?.();
					viewers.delete(sender);
					const page = next ? interactive.pages.get(next.targetId) : undefined;
					if (!next || !page) return;
					pane.width = next.width;
					pane.height = next.height;
					await page.bringToFront();
					await fit(page);
					const stop = cast(page, (frame) => {
						if (sender.isDestroyed()) {
							stop();
							viewers.delete(sender);
						} else sender.send(BrowserChannels.frame, { targetId: next.targetId, ...frame });
					});
					viewers.set(sender, stop);
				})
				.catch(() => undefined);
		});
		trusted.command(BrowserChannels.input, (request) => {
			const event = inputSchema.parse(request);
			const page = interactive.pages.get(event.targetId);
			if (page) inputs = inputs.then(() => input(page, event)).catch(() => undefined);
		});
	}
}
