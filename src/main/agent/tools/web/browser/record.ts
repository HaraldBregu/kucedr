import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type { BrowserRoute } from '../../../../../shared/browser';
import { connections } from '../../../../browser/connections';
import { getPrivacyRoute, isPrivacyEnabled } from '../../../../privacy/state';
import { saveMedia } from '../../../../shared/media';
import { executionScope } from '../../../execution/scope';

export type CaptureKind = 'screenshot' | 'screenshot-element' | 'screenshot-full' | 'pdf' | 'archive';

export interface CapturedPage {
	url: string;
	title: string;
	route: BrowserRoute;
	workspace: string;
}

const EXTENSIONS: Record<CaptureKind, string> = {
	screenshot: 'png',
	'screenshot-element': 'png',
	'screenshot-full': 'png',
	pdf: 'pdf',
	archive: 'mhtml',
};

// Saves a capture and writes `<file>.json` beside it: what the page was, when, over which route,
// and the SHA-256 of the bytes written, so someone else can check the file later.
export async function saveCapture(
	kind: CaptureKind,
	base64: string,
	page: CapturedPage,
	directory?: string,
	signal?: AbortSignal
): Promise<{ path: string; sha256: string; record: string }> {
	const time = new Date().toISOString();
	const file = await saveMedia('browser', EXTENSIONS[kind], base64, directory, signal);
	const sha256 = createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex');
	const privacy = isPrivacyEnabled();
	const proxy = privacy
		? getPrivacyRoute()
		: page.route === 'proxy'
			? connections().proxy
			: page.route === 'tor'
				? connections().tor
				: undefined;
	const name = path.basename(file);
	const record = `${file}.json`;
	const chat = executionScope.getStore()?.sessionId;
	await fs.writeFile(
		record,
		`${JSON.stringify(
			{
				id: name.slice(name.indexOf('-', 'browser-'.length) + 1, -(EXTENSIONS[kind].length + 1)),
				file: name,
				sha256,
				kind,
				url: page.url,
				title: page.title,
				time,
				route: page.route,
				...(proxy ? { proxy: proxy.replace(/^\w+:\/\//, '') } : {}),
				privacyMode: privacy,
				workspace: page.workspace,
				...(chat ? { chat } : {}),
				by: 'agent',
				app: app.getVersion(),
			},
			null,
			2
		)}\n`,
		{ signal }
	);
	return { path: file, sha256, record };
}
