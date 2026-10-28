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
const bundle = fs.readFileSync(new URL('browser.js', import.meta.url), 'utf8');
const font = fs.readFileSync(new URL('virgil.woff2', import.meta.url)).toString('base64');

process.stdout.write(`<!doctype html>
<html style="color-scheme:${dark ? 'dark' : 'light'}"><head><meta charset="utf-8"><style>
@font-face{font-family:Virgil;src:url(data:font/woff2;base64,${font}) format('woff2')}
html,body{height:100%;margin:0;background:var(--background,Canvas);color:var(--foreground,CanvasText);font:13px system-ui,sans-serif}
body{display:flex;flex-direction:column;padding:8px 12px;box-sizing:border-box}
h3{margin:0;font-size:14px;font-weight:600}p{margin:2px 0 0;opacity:.7}
#draw{display:flex;flex:1;min-height:0;align-items:center;justify-content:center;overflow:hidden}
#draw svg{display:block;width:100%;height:100%}
h3 + #draw,p + #draw{margin-top:8px}
</style></head><body>
${title ? `<h3>${escape(title)}</h3>` : ''}${input.description ? `<p>${escape(input.description)}</p>` : ''}
<div id="draw" role="img" aria-label="${escape(title || input.description || 'Drawing')}"></div>
<script id="draw-input" type="application/json">${data}</script>
<script>${bundle.replace(/<\/script/gi, '<\\/script')}</script>
</body></html>`);
