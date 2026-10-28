import { CATALOG, COMPONENTS } from './catalog.mjs';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function validate(input) {
	if (!isObject(input)) throw new Error('input must be an object.');
	const entry = CATALOG[input.component];
	if (!entry) throw new Error(`component must be one of: ${COMPONENTS.join(', ')}.`);
	if (input.props !== undefined && !isObject(input.props)) throw new Error('props must be an object.');
	const props = input.props ?? {};
	const missing = entry.required.filter((key) => props[key] === undefined || props[key] === null);
	if (missing.length) throw new Error(`${input.component} needs props: ${missing.join(', ')}.`);
	if (input.component === 'shader' && !/float\s+field\s*\(/.test(String(props.field)))
		throw new Error('shader field must be GLSL that defines float field(vec2 uv, vec2 res, float t).');
	if (input.title !== undefined && typeof input.title !== 'string')
		throw new Error('title must be a string when provided.');
	if (input.description !== undefined && typeof input.description !== 'string')
		throw new Error('description must be a string.');
}
