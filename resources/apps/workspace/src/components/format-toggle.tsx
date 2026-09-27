import { ToggleGroup } from './ui/toggle-group';
import { ToggleGroupItem } from './ui/toggle-item';

interface FormatToggleProps {
	formatted: boolean;
	onFormattedChange: (formatted: boolean) => void;
}

export function FormatToggle({ formatted, onFormattedChange }: FormatToggleProps) {
	return (
		<ToggleGroup
			type="single"
			value={formatted ? 'text' : 'raw'}
			onValueChange={(value) => onFormattedChange(value === 'text')}
			aria-label="Markdown view"
		>
			<ToggleGroupItem value="raw" aria-label="Raw Markdown">
				Raw
			</ToggleGroupItem>
			<ToggleGroupItem value="text" aria-label="Formatted text">
				Text
			</ToggleGroupItem>
		</ToggleGroup>
	);
}
