// Reads { input, theme } JSON on stdin and prints a self-contained HTML OrganUI component.
import fs from 'node:fs';
import { validate } from './validate.mjs';

const escape = (value) => String(value).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

const { input, theme } = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
try {
	validate(input);
} catch (error) {
	process.stderr.write(error.message);
	process.exit(1);
}
const data = JSON.stringify(input).replace(/</g, '\\u003c');
const title = input.title?.trim();
const dark = theme === 'dark';
const read = (file) => fs.readFileSync(new URL(file, import.meta.url), 'utf8');

process.stdout.write(`<!doctype html>
<html class="${dark ? 'dark' : ''}" style="color-scheme:${dark ? 'dark' : 'light'}"><head><meta charset="utf-8"><style>${read('styles.css')}</style></head><body>
${title ? `<h3 class="text-sm font-semibold">${escape(title)}</h3>` : ''}${input.description ? `<p class="-mt-2 text-muted-foreground">${escape(input.description)}</p>` : ''}
<div id="organui" class="flex min-h-0 flex-1 flex-col"></div>
<script id="organui-input" type="application/json">${data}</script>
<script>${read('browser.js').replace(/<\/script/gi, '<\\/script')}</script>
</body></html>`);
