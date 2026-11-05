import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { modelChoice } from './Choice';

interface OptionProps {
	readonly capability: Parameters<typeof modelChoice>[0];
	readonly names: readonly string[];
	readonly label: string;
	readonly providerId: string;
	readonly modelId: string;
	readonly disabled?: boolean;
}

export function Option({ capability, names, label, providerId, modelId, disabled }: OptionProps): React.JSX.Element | null {
	const [options, setOptions] = useState<Record<string, Record<string, string>>>({});
	useEffect(() => { void window.app.getWorkspaceModelOptions().then(setOptions); }, []);
	const choice = modelChoice(capability, names, providerId, modelId, options);
	if (!choice) return null;
	const { key, name, value, choices } = choice;
	return <Select value={value} disabled={disabled} onValueChange={(next) => {
		setOptions({ ...options, [key]: { ...options[key], [name]: String(next) } });
		void window.app.setWorkspaceModelOption({ key, name, value: String(next) });
	}}>
		<SelectTrigger aria-label={label} className="rounded-full border-0 px-2 text-sm text-foreground capitalize shadow-none hover:bg-muted aria-expanded:bg-muted data-[size=default]:h-9 dark:bg-transparent dark:hover:bg-muted/50">
			<SelectValue>{choices.find((item) => item.value === value)?.label}</SelectValue>
		</SelectTrigger>
		<SelectContent>
			{choices.map((item) => <SelectItem key={item.value} value={item.value} className="capitalize">{item.label}</SelectItem>)}
		</SelectContent>
	</Select>;
}
