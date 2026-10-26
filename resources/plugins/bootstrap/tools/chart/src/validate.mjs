const TYPES = ['bar', 'line', 'area', 'pie', 'doughnut'];

export function validate(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object.');
	if (!TYPES.includes(input.type)) throw new Error(`type must be one of: ${TYPES.join(', ')}.`);
	if (typeof input.title !== 'string' || !input.title.trim()) throw new Error('title is required.');
	if (input.description !== undefined && typeof input.description !== 'string') throw new Error('description must be a string.');
	if (!Array.isArray(input.data) || input.data.length === 0 || input.data.length > 200)
		throw new Error('data must contain between 1 and 200 rows.');
	if (typeof input.xKey !== 'string' || !input.xKey) throw new Error('xKey is required: the field that holds each category or label.');
	if (!input.data.every((row) => row && typeof row === 'object' && !Array.isArray(row) &&
		Object.hasOwn(row, input.xKey) && ['string', 'number'].includes(typeof row[input.xKey])))
		throw new Error(`every data row needs the xKey field "${input.xKey}".`);
	if (!Array.isArray(input.series) || input.series.length === 0 || input.series.length > 6)
		throw new Error('series must contain between 1 and 6 { key, label } entries.');
	if (!input.series.every((series) => series && typeof series.key === 'string' && series.key.trim() &&
		typeof series.label === 'string' && series.label.trim()))
		throw new Error('every series needs a non-empty key and label.');
	for (const { key } of input.series)
		if (!input.data.every((row) => Object.hasOwn(row, key) && Number.isFinite(row[key])))
			throw new Error(`series "${key}" must be a finite number in every data row.`);
}

