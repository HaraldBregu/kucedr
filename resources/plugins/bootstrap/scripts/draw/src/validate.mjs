const TYPES = ['rectangle', 'ellipse', 'diamond', 'text', 'line', 'arrow'];

export function validate(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input))
		throw new Error('input must be an object.');
	for (const field of ['title', 'description'])
		if (input[field] !== undefined && typeof input[field] !== 'string')
			throw new Error(`${field} must be a string when provided.`);
	if (!Array.isArray(input.elements) || input.elements.length < 1 || input.elements.length > 200)
		throw new Error('elements must contain between 1 and 200 elements.');
	const ids = new Set();
	for (const element of input.elements) {
		if (!element || !TYPES.includes(element.type))
			throw new Error(`element type must be one of: ${TYPES.join(', ')}.`);
		if (!Number.isFinite(element.x) || !Number.isFinite(element.y))
			throw new Error('every element needs finite x and y coordinates.');
		for (const field of [
			'width',
			'height',
			'angle',
			'strokeWidth',
			'roughness',
			'opacity',
			'fontSize',
			'seed',
		])
			if (element[field] !== undefined && !Number.isFinite(element[field]))
				throw new Error(`element ${field} must be a finite number.`);
		if (element.type === 'text' && typeof element.text !== 'string')
			throw new Error('text elements need a text string.');
		if (element.label !== undefined && (!element.label || typeof element.label.text !== 'string'))
			throw new Error('label needs a text string.');
		if (
			element.points !== undefined &&
			(!Array.isArray(element.points) ||
				element.points.length < 2 ||
				!element.points.every(
					(point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)
				))
		)
			throw new Error('points must contain at least two finite [x, y] pairs.');
		if (element.id !== undefined) {
			if (typeof element.id !== 'string' || !element.id.trim() || ids.has(element.id))
				throw new Error('element ids must be unique non-empty strings.');
			ids.add(element.id);
		}
	}
	for (const element of input.elements)
		for (const binding of [element.start, element.end])
			if (binding !== undefined && (!binding || !ids.has(binding.id)))
				throw new Error('arrow start and end must reference an element id.');
}
