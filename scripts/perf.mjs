// Performance check (roadmap 2.7): bundle size, start time and streaming smoothness of a built app.
// Usage: npm run build && npm run perf [-- <app folder>]
import { _electron as electron } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const appDir = path.resolve(process.argv[2] ?? '.');
const RUNS = 3;
const CHUNKS = 600;
const END = 'Performance check complete.';

async function files(dir) {
	const entries = await readdir(dir, { withFileTypes: true, recursive: true });
	return Promise.all(
		entries
			.filter((entry) => entry.isFile() && !entry.name.endsWith('.map'))
			.map(async (entry) => {
				const file = path.join(entry.parentPath, entry.name);
				return { file, bytes: (await stat(file)).size };
			})
	);
}

const bundle = {};
for (const part of ['main', 'preload', 'renderer']) {
	const list = await files(path.join(appDir, 'out', part));
	bundle[`${part}KB`] = Math.round(list.reduce((sum, item) => sum + item.bytes, 0) / 1024);
	if (part === 'renderer') {
		const largest = list.filter((item) => item.file.endsWith('.js')).sort((a, b) => b.bytes - a.bytes)[0];
		bundle.largestRendererChunkKB = Math.round(largest.bytes / 1024);
	}
}

const server = createServer((request, response) => {
	if (request.url.endsWith('/models')) {
		response.setHeader('content-type', 'application/json');
		return response.end(JSON.stringify({ data: [{ id: 'perf-test' }] }));
	}
	let body = '';
	request.on('data', (chunk) => (body += chunk));
	request.on('end', async () => {
		const send = (delta, finish = null) =>
			`data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
		if (!JSON.parse(body || '{}').stream) {
			response.setHeader('content-type', 'application/json');
			return response.end(JSON.stringify({ choices: [{ index: 0, message: { role: 'assistant', content: 'Perf' }, finish_reason: 'stop' }] }));
		}
		response.setHeader('content-type', 'text/event-stream');
		for (let index = 0; index < CHUNKS; index += 1) {
			const text = index === 200 ? '\n\n```js\n' : index === 260 ? '\n```\n\n' : index % 60 === 59 ? `word${index}\n\n` : `word${index} `;
			response.write(send({ content: text }));
			await new Promise((resolve) => setTimeout(resolve, 5));
		}
		response.write(send({ content: END }));
		response.write(send({}, 'stop'));
		response.end('data: [DONE]\n\n');
	});
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;

const dataDir = await mkdtemp(path.join(os.tmpdir(), 'kucedr-perf-'));
const median = (values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
const windowMs = [];
const renderMs = [];
let streaming;
try {
	for (let run = 0; run < RUNS; run += 1) {
		const started = performance.now();
		const app = await electron.launch({
			cwd: appDir,
			args: [`--user-data-dir=${dataDir}`, appDir],
			env: { ...process.env, NODE_ENV: 'production', ELECTRON_RENDERER_URL: '', KUCEDR_E2E_DATA_ROOT: dataDir },
		});
		try {
			const page = await app.firstWindow();
			windowMs.push(performance.now() - started);
			await page.waitForSelector('#root > *');
			renderMs.push(performance.now() - started);
			if (run < RUNS - 1) continue;
			await page.evaluate(async (url) => {
				await window.provider.set({ kind: 'models', id: 'custom', apiKey: 'perf-test', baseUrl: url });
				await window.agent.setProvider({ id: 'custom', name: 'Custom model provider', baseUrl: url });
				await window.agent.setModelId('perf-test');
				sessionStorage.setItem('kucedr-auth-local-only', 'true');
				sessionStorage.setItem('kucedr-onboarding-started', 'true');
			}, baseUrl);
			await page.reload();
			const editor = page.locator('[data-slot="home-composer-shell"] [role="textbox"]');
			await editor.waitFor();
			await page.evaluate(() => {
				const perf = { longTasks: [], frames: [], on: true };
				window.__perf = perf;
				new PerformanceObserver((list) => list.getEntries().forEach((entry) => perf.longTasks.push(entry.duration))).observe({ type: 'longtask' });
				let last = performance.now();
				const tick = (now) => {
					perf.frames.push(now - last);
					last = now;
					if (perf.on) requestAnimationFrame(tick);
				};
				requestAnimationFrame(tick);
			});
			const sent = performance.now();
			await editor.fill('Write a long answer.');
			await editor.press('Enter');
			await page.getByText(END, { exact: false }).waitFor({ timeout: 60_000 });
			const durationMs = performance.now() - sent;
			const { longTasks, frames } = await page.evaluate(() => {
				window.__perf.on = false;
				return window.__perf;
			});
			streaming = {
				chunks: CHUNKS,
				durationMs: Math.round(durationMs),
				fps: Math.round((frames.length / durationMs) * 1000),
				framesOver50Ms: frames.filter((gap) => gap > 50).length,
				longestFrameMs: Math.round(Math.max(...frames)),
				longTasks: longTasks.length,
				longTaskMs: Math.round(longTasks.reduce((sum, value) => sum + value, 0)),
			};
		} finally {
			await app.close();
		}
	}
} finally {
	server.close();
	await rm(dataDir, { recursive: true, force: true });
}

const result = {
	...bundle,
	firstWindowMs: Math.round(median(windowMs)),
	firstRenderMs: Math.round(median(renderMs)),
	...streaming,
};
console.table(result);
console.log(JSON.stringify(result));
