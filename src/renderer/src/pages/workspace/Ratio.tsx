import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { modelsFor } from '@/lib/providers';

export type ImageOptions = Readonly<Record<string, Readonly<Record<string, string>>>>;

interface RatioProps {
	readonly providerId: string;
	readonly modelId: string;
	readonly options: ImageOptions;
	readonly disabled?: boolean;
	readonly onChange: (options: ImageOptions) => void;
}

export function Ratio({ providerId, modelId, options, disabled, onChange }: RatioProps): React.JSX.Element | null {
	const metadata = modelsFor('text-to-image').find((model) => model.provider.id === providerId && model.id === modelId)?.metadata;
	const inputs = metadata?.documentationStatus === 'verified' ? metadata.inputs : {};
	const name = inputs.aspect_ratio ? 'aspect_ratio' : 'size';
	const input = inputs[name];
	const choices = input?.oneOf?.map((choice) => ({ value: String(choice.const), label: choice.title ?? String(choice.const) })) ?? input?.enum?.map((choice) => ({ value: String(choice), label: String(choice) })) ?? [];
	if (choices.length === 0) return null;
	const key = `${providerId}:${modelId}`;
	const value = options[key]?.[name] ?? String(input?.default ?? choices[0].value);
	return <Select value={value} disabled={disabled} onValueChange={(next) => onChange({ ...options, [key]: { [name]: String(next) } })}>
		<SelectTrigger aria-label="Aspect ratio" className="rounded-full border-0 px-2 text-sm text-foreground capitalize shadow-none hover:bg-muted aria-expanded:bg-muted data-[size=default]:h-9 dark:bg-transparent dark:hover:bg-muted/50">
			<SelectValue>{choices.find((choice) => choice.value === value)?.label}</SelectValue>
		</SelectTrigger>
		<SelectContent>
			{choices.map((choice) => <SelectItem key={choice.value} value={choice.value} className="capitalize">{choice.label}</SelectItem>)}
		</SelectContent>
	</Select>;
}
