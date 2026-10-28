import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { PluginScriptSchema } from '../../../../shared/plugin_types';

interface PropertiesProps {
	readonly schema: PluginScriptSchema;
	readonly value: Record<string, unknown>;
	readonly onChange: (value: Record<string, unknown>) => void;
}

/** A form for a script's top-level input properties; nested objects and arrays are edited as JSON. */
export function ScriptProperties({ schema, value, onChange }: PropertiesProps): React.JSX.Element {
	const [invalid, setInvalid] = useState<string | null>(null);
	const set = (key: string, next: unknown): void => {
		const { [key]: _, ...rest } = value;
		onChange(next === undefined || next === '' ? rest : { ...rest, [key]: next });
	};

	return (
		<div className="flex flex-col gap-3">
			{Object.entries(schema.properties ?? {}).map(([key, property]) => {
				const id = `script-property-${key}`;
				const label = `${property.title ?? key}${schema.required?.includes(key) ? ' *' : ''}`;
				const current = value[key];
				return (
					<div key={key} className="flex flex-col gap-1.5">
						<Label htmlFor={id}>{label}</Label>
						{property.enum ? (
							<Select value={typeof current === 'string' ? current : ''} onValueChange={(next) => set(key, next ?? undefined)}>
								<SelectTrigger id={id} size="sm" className="w-full">
									<SelectValue>{typeof current === 'string' ? current : ''}</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{property.enum.map((option) => (
										<SelectItem key={option} value={option}>{option}</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : property.type === 'string' || property.type === 'number' || property.type === 'integer' ? (
							<Input
								id={id}
								className="h-8 text-sm"
								type={property.type === 'string' ? 'text' : 'number'}
								value={typeof current === 'string' || typeof current === 'number' ? current : ''}
								onChange={(event) => set(key, property.type === 'string' || event.target.value === '' ? event.target.value : Number(event.target.value))}
							/>
						) : (
							<Textarea
								key={JSON.stringify(current)}
								id={id}
								className="min-h-24 font-mono text-xs"
								spellCheck={false}
								defaultValue={current === undefined ? '' : JSON.stringify(current, null, 2)}
								aria-invalid={invalid === key}
								onBlur={(event) => {
									const text = event.target.value.trim();
									try {
										set(key, text ? JSON.parse(text) : undefined);
										setInvalid(null);
									} catch {
										setInvalid(key);
									}
								}}
							/>
						)}
						{invalid === key ? (
							<p className="text-xs text-destructive">Invalid JSON</p>
						) : property.description ? (
							<p className="text-xs text-muted-foreground">{property.description}</p>
						) : null}
					</div>
				);
			})}
		</div>
	);
}
