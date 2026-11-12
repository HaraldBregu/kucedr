import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { PluginScriptSchema } from '../../../../shared/plugin_types';
import { inferScriptSchema } from './Infer';

interface PropertiesProps {
	readonly schema: PluginScriptSchema;
	readonly value: unknown;
	readonly onChange: (value: unknown) => void;
	readonly id?: string;
	readonly inline?: boolean;
	readonly root?: unknown;
}

/** A form for a script's input: one field per property, rows for lists, and JSON only for values with no known shape. */
export function ScriptProperties({ schema, value, onChange, id = 'script-property', inline, root = value }: PropertiesProps): React.JSX.Element {
	const [invalid, setInvalid] = useState(false);
	if (schema.type === 'object' && !schema.properties && value && typeof value === 'object' && Object.keys(value).length) schema = inferScriptSchema(value);

	if (schema.enum) {
		return (
			<Select value={typeof value === 'string' ? value : ''} onValueChange={(next) => onChange(next ?? undefined)}>
				<SelectTrigger id={id} size="sm" className="w-full">
					<SelectValue>{typeof value === 'string' ? value : ''}</SelectValue>
				</SelectTrigger>
				<SelectContent>
					{schema.enum.map((option) => (
						<SelectItem key={option} value={option}>{option}</SelectItem>
					))}
				</SelectContent>
			</Select>
		);
	}
	if (schema.type === 'boolean') return <Switch id={id} checked={value === true} onCheckedChange={onChange} />;
	if (schema.type === 'string' || schema.type === 'number' || schema.type === 'integer') {
		return (
			<Input
				id={id}
				className="h-8 text-sm"
				type={schema.type === 'string' ? 'text' : 'number'}
				min={schema.minimum}
				max={schema.maximum}
				step={schema.type === 'number' ? 'any' : undefined}
				value={typeof value === 'string' || typeof value === 'number' ? value : ''}
				onChange={(event) => onChange(schema.type === 'string' ? event.target.value : event.target.value === '' ? undefined : Number(event.target.value))}
			/>
		);
	}
	if (schema.type === 'array') {
		const items = Array.isArray(value) ? value : [];
		const inferred = inferScriptSchema(items.some((item) => item && typeof item === 'object') ? Object.assign({}, ...items) : items[0]);
		const hinted = Object.fromEntries((schema.keys ?? []).flatMap(({ from, type }) => {
			const [head, tail] = from.split('.');
			const source = (root as Record<string, unknown> | undefined)?.[head];
			const names: unknown[] = tail ? (Array.isArray(source) ? source.map((entry) => (entry as Record<string, unknown> | null)?.[tail]) : []) : [source];
			return names.filter((name) => typeof name === 'string' && name).map((name) => [name as string, { type }]);
		}));
		const itemSchema: PluginScriptSchema = { ...inferred, ...schema.items, properties: inferred.properties || schema.items?.properties || schema.keys ? { ...hinted, ...inferred.properties, ...schema.items?.properties } : undefined };
		const last = items.at(-1);
		const blank = last && typeof last === 'object'
			? Object.fromEntries(Object.entries(last).filter(([, item]) => typeof item !== 'object').map(([key, item]) => [key, typeof item === 'number' ? 0 : typeof item === 'boolean' ? false : '']))
			: itemSchema.type === 'string' ? '' : itemSchema.type === 'number' || itemSchema.type === 'integer' ? 0 : {};
		return (
			<div className="flex flex-col gap-2">
				{items.map((item, index) => (
					<div key={index} className="flex items-end gap-1 rounded-md border p-2">
						<div className="min-w-0 flex-1">
							<ScriptProperties inline id={`${id}-${index}`} schema={itemSchema} value={item} onChange={(next) => onChange(items.map((current, position) => position === index ? next : current))} />
						</div>
						<Button type="button" variant="ghost" size="icon-sm" aria-label="Remove" disabled={items.length <= (schema.minItems ?? 0)} onClick={() => onChange(items.filter((_, position) => position !== index))}>
							<Trash2 />
						</Button>
					</div>
				))}
				<Button type="button" variant="outline" size="sm" className="self-start" disabled={items.length >= (schema.maxItems ?? Infinity)} onClick={() => onChange([...items, blank])}>
					<Plus />Add
				</Button>
			</div>
		);
	}
	if (schema.properties) {
		const object = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
		return (
			<div className={inline ? 'flex flex-wrap gap-2' : 'flex flex-col gap-3'}>
				{Object.entries(schema.properties).map(([key, property]) => (
					<div key={key} className="flex min-w-24 flex-1 flex-col gap-1.5">
						<Label htmlFor={`${id}-${key}`}>{property.title ?? key}{schema.required?.includes(key) ? ' *' : ''}</Label>
						<ScriptProperties inline id={`${id}-${key}`} schema={property} value={object[key]} onChange={(next) => {
							const { [key]: _, ...rest } = object;
							onChange(next === undefined || next === '' ? rest : { ...object, [key]: next });
						}} />
						{property.description ? <p className="text-xs text-muted-foreground">{property.description}</p> : null}
					</div>
				))}
			</div>
		);
	}
	return (
		<>
			<Textarea
				key={JSON.stringify(value)}
				id={id}
				className="min-h-24 font-mono text-xs"
				spellCheck={false}
				defaultValue={value === undefined ? '' : JSON.stringify(value, null, 2)}
				aria-invalid={invalid}
				onBlur={(event) => {
					const text = event.target.value.trim();
					try {
						onChange(text ? JSON.parse(text) : undefined);
						setInvalid(false);
					} catch {
						setInvalid(true);
					}
				}}
			/>
			{invalid ? <p className="text-xs text-destructive">Invalid JSON</p> : null}
		</>
	);
}
