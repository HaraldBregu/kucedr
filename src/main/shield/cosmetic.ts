import { readFileSync } from 'node:fs';
import path from 'node:path';
import { resourceRoot } from '../shared/resource_root';

// `domains##selector` hides, `domains#@#selector` excepts. Extended syntax (#?#, #$#, ##+js, ##^)
// and rules with ~domain or wildcard domains are skipped.
const RULE = /^([a-z0-9.,*~-]*)#(@?)#([^+^].*)$/i;

type Selectors = Map<string, Set<string>>;

let rules: { generic: string[]; css: string; specific: Selectors; except: Selectors } | undefined;

const hide = (selectors: Iterable<string>): string =>
	[...selectors].map((selector) => `${selector}{display:none!important}`).join('\n');

function load(): NonNullable<typeof rules> {
	if (rules) return rules;
	const generic = new Set<string>();
	const specific: Selectors = new Map();
	const except: Selectors = new Map();
	const text = ['easylist.txt', 'easylist-cookie.txt']
		.map((name) => readFileSync(path.join(resourceRoot(), 'resources/shield', name), 'utf8'))
		.join('\n');
	for (const line of text.split(/\r?\n/)) {
		const rule = RULE.exec(line.trim());
		if (!rule) continue;
		const [, domains, exception, selector] = rule;
		// A brace or comment would let a selector break out of its own CSS rule.
		if (/[{}]|\/\*/.test(selector) || /[~*]/.test(domains)) continue;
		if (!domains && !exception) {
			generic.add(selector);
			continue;
		}
		const target = exception ? except : specific;
		for (const domain of domains ? domains.toLowerCase().split(',') : ['']) {
			target.set(domain, (target.get(domain) ?? new Set()).add(selector));
		}
	}
	rules = { generic: [...generic], css: hide(generic), specific, except };
	return rules;
}

// ponytail: one stylesheet of every generic selector (~29k rules, ~1 MB) per page; switch to
// per-page selector matching if page loads show it in a profile.
export function cosmetic(host: string): string {
	const { generic, css, specific, except } = load();
	const parents = ['', ...host.toLowerCase().replace(/\.+$/, '').split('.').map((_, index, parts) => parts.slice(index).join('.'))];
	const excepted = new Set(parents.flatMap((parent) => [...(except.get(parent) ?? [])]));
	const own = parents.flatMap((parent) => [...(specific.get(parent) ?? [])]).filter((selector) => !excepted.has(selector));
	const base = excepted.size ? hide(generic.filter((selector) => !excepted.has(selector))) : css;
	return `${base}\n${hide(own)}`;
}
