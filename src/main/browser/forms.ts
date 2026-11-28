import path from 'node:path';
import { currentWorkspace } from '../workspaces/current';
import { VaultError } from '../vault/error';
import { readSealed } from '../vault/read';
import { seal } from '../vault/seal';
import { writeFileAtomic } from './write';

// Values typed into ordinary form fields, by site origin and field name, newest first.
type Forms = Record<string, Record<string, string[]>>;

const PER_FIELD = 20;
const cache = new Map<string, Forms>();

function load(): { file: string; forms: Forms } {
	const file = path.join(currentWorkspace().browser, 'forms.json');
	let forms = cache.get(file);
	if (!forms) {
		try {
			forms = JSON.parse(readSealed(file)) as Forms;
		} catch (error) {
			if (error instanceof VaultError) throw error;
			forms = {};
		}
		cache.set(file, forms);
	}
	return { file, forms };
}

function save(file: string, forms: Forms): void {
	writeFileAtomic(file, seal(JSON.stringify(forms)));
}

export function formValues(origin: string, field: string): string[] {
	return load().forms[origin]?.[field] ?? [];
}

export function rememberForm(origin: string, entries: readonly (readonly [string, string])[]): void {
	if (!entries.length) return;
	const { file, forms } = load();
	const site = (forms[origin] ??= {});
	for (const [field, value] of entries) {
		site[field] = [value, ...(site[field] ?? []).filter((item) => item !== value)].slice(0, PER_FIELD);
	}
	save(file, forms);
}

export function forgetFormValue(origin: string, field: string, value: string): void {
	const { file, forms } = load();
	const values = forms[origin]?.[field];
	if (!values?.includes(value)) return;
	forms[origin][field] = values.filter((item) => item !== value);
	save(file, forms);
}
