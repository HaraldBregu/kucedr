import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { JsonOption } from '@/components/json';
import type { ModelInputSchema } from '@shared/model_types';
import { SettingsRow } from '@pages/settings/components';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModelOptionsProps {
	readonly inputs: Readonly<Record<string, ModelInputSchema>>;
	readonly values: Readonly<Record<string, unknown>>;
	readonly excludedInputs?: ReadonlySet<string>;
	readonly allowComplex?: boolean;
	readonly inlineAdvanced?: boolean;
	readonly onChange: (path: readonly string[], value: unknown) => void;
}

const RESERVED_INPUTS = new Set([
	'max_tokens',
	'maxOutputTokens',
	'metadata',
	'stream',
	'stream_options',
	'tool_choice',
	'tools',
]);

export function ModelOptions({
	inputs,
	values,
	excludedInputs,
	allowComplex = false,
	inlineAdvanced = false,
	onChange,
}: ModelOptionsProps): React.JSX.Element | null {
	const entries: Array<{ path: string[]; schema: ModelInputSchema }> = [];
	const pending = Object.entries(inputs).map(([key, schema]) => ({ path: [key], schema }));
	while (pending.length > 0) {
		const entry = pending.shift();
		if (
			!entry ||
			(RESERVED_INPUTS.has(entry.path[0]) && !(allowComplex && entry.path[0] === 'metadata')) ||
			excludedInputs?.has(entry.path[0])
		)
			continue;
		if (entry.schema.type === 'object' && entry.schema.properties) {
			pending.unshift(
				...Object.entries(entry.schema.properties).map(([key, schema]) => ({
					path: [...entry.path, key],
					schema,
				}))
			);
			continue;
		}
		if (
			entry.schema.type === 'string' ||
			entry.schema.type === 'number' ||
			entry.schema.type === 'integer' ||
			entry.schema.type === 'boolean'
		) {
			entries.push(entry);
		} else if (allowComplex && (entry.schema.type === 'array' || entry.schema.type === 'object')) {
			entries.push(entry);
		}
	}
	if (entries.length === 0) return null;
	const rendered = entries.map(({ path, schema }) => {
		let value: unknown = values;
		for (const key of path) {
			value =
				value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
		}
		const key = path.join('.');
		const label = schema.title ?? path.map((part) => part.replaceAll('_', ' ')).join(' ');
		const choices =
			schema.oneOf?.map((choice) => ({
				label: choice.title ?? String(choice.const),
				value: choice.const,
			})) ??
			schema.enum?.map((choice) => ({ label: String(choice), value: choice })) ??
			[];
		const defaultLabel =
			schema.default === undefined
				? 'Provider default'
				: `Provider default (${String(schema.default)})`;
		let node: React.JSX.Element;
		if (choices.length > 0) {
			const selectedIndex = choices.findIndex((choice) => Object.is(choice.value, value));
				node = (
					<SettingsRow
						key={key}
						className={inlineAdvanced ? 'border-b-0' : undefined}
						title={label}
					actions={
						<Select
							value={selectedIndex < 0 ? '__default__' : String(selectedIndex)}
							onValueChange={(next) =>
								onChange(path, next === '__default__' ? undefined : choices[Number(next)]?.value)
							}
						>
							<SelectTrigger className="w-40" aria-label={label}>
								<SelectValue>
									{selectedIndex < 0 ? defaultLabel : choices[selectedIndex]?.label}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__default__">{defaultLabel}</SelectItem>
								{choices.map((choice, index) => (
									<SelectItem key={`${String(choice.value)}-${index}`} value={String(index)}>
										{choice.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					}
				/>
			);
		} else if (schema.type === 'boolean') {
			const checked = value === undefined ? schema.default === true : value === true;
				node = (
					<SettingsRow
						key={key}
						className={inlineAdvanced ? 'border-b-0' : undefined}
						title={label}
					actions={
						<Switch
							aria-label={label}
							checked={checked}
							onCheckedChange={(checked) => onChange(path, checked)}
						/>
					}
				/>
			);
		} else if (schema.type === 'array' || schema.type === 'object') {
				node = (
					<SettingsRow
						key={key}
						className={inlineAdvanced ? 'border-b-0' : undefined}
						title={label}
					description={schema.description}
					actionClassName="sm:max-w-[60%]"
					actions={
						<JsonOption label={label} value={value} onChange={(next) => onChange(path, next)} />
					}
				/>
			);
		} else {
			const numeric = schema.type === 'number' || schema.type === 'integer';
			const displayedValue = value === undefined ? schema.default : value;
				node = (
					<SettingsRow
						key={key}
						className={inlineAdvanced ? 'border-b-0' : undefined}
						title={label}
					actions={
						<Input
							aria-label={label}
							className="w-40"
							type={numeric ? 'number' : 'text'}
							min={schema.minimum}
							max={schema.maximum}
							step={schema.type === 'integer' ? 1 : undefined}
							value={
								typeof displayedValue === 'string' || typeof displayedValue === 'number'
									? String(displayedValue)
									: ''
							}
							onChange={(event) =>
								onChange(
									path,
									event.target.value === ''
										? undefined
										: numeric
											? Number(event.target.value)
											: event.target.value
								)
							}
						/>
					}
				/>
			);
		}
		return {
			primary: path.some(
				(part) =>
					part.includes('effort') ||
					part.includes('thinking') ||
					part.toLowerCase() === 'voice' ||
					part.toLowerCase() === 'voice_id' ||
					part.toLowerCase() === 'voicename'
			),
			node,
		};
	});
	const primary = rendered.filter((entry) => entry.primary).map((entry) => entry.node);
	const advanced = rendered.filter((entry) => !entry.primary).map((entry) => entry.node);

	return (
		<div className={cn('-mx-4 -mb-4 mt-1', !inlineAdvanced && 'border-t border-border/60')}>
			{primary}
			{advanced.length > 0 && (
				inlineAdvanced ? (
					<>
						<div className="px-4 py-3 text-[12px] font-medium text-muted-foreground">
							Advanced properties
						</div>
						{advanced}
					</>
				) : (
					<Collapsible>
						<CollapsibleTrigger className="group flex min-h-10 w-full items-center justify-between px-4 py-3 text-left text-[12px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
							<span>Advanced</span>
							<ChevronDown className="size-3.5 transition-transform group-data-panel-open:rotate-180" />
						</CollapsibleTrigger>
						<CollapsibleContent className="border-t border-border/60">{advanced}</CollapsibleContent>
					</Collapsible>
				)
			)}
		</div>
	);
}
