import { z } from 'zod';
import type { ModelInputSchema } from '../../../../shared/model_types';

export function modelOption(input: ModelInputSchema): z.ZodType | undefined {
	const choices = input.oneOf?.map((choice) => String(choice.const)) ?? input.enum?.map(String);
	const titles = input.oneOf
		?.filter((choice) => choice.title && choice.title !== String(choice.const))
		.map((choice) => `${String(choice.const)} = ${choice.title}`)
		.join(', ');
	const description = [
		input.title && `${input.title}.`,
		input.description,
		titles && `Values: ${titles}.`,
		input.default !== undefined && `Defaults to ${String(input.default)}.`,
	]
		.filter(Boolean)
		.join(' ');
	let schema: z.ZodType;
	if (input.type === 'string') {
		schema = choices?.length ? z.enum(choices as [string, ...string[]]) : z.string();
	} else if (input.type === 'number' || input.type === 'integer') {
		let number = input.type === 'integer' ? z.number().int() : z.number();
		if (input.minimum !== undefined) number = number.min(input.minimum);
		if (input.maximum !== undefined) number = number.max(input.maximum);
		schema = number;
	} else if (input.type === 'boolean') {
		schema = z.boolean();
	} else {
		return undefined;
	}
	return (description ? schema.describe(description) : schema).optional();
}
