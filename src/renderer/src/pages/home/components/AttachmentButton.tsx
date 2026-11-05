import type { ReactElement } from 'react';
import { Library, MonitorUp, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PromptInputAction, usePromptInput } from '@/components/ui/prompt-input';

export function AttachmentButton({
	disabled,
	onLibrarySelect,
}: {
	readonly disabled?: boolean;
	readonly onLibrarySelect: () => void;
}): ReactElement {
	const { triggerFileUpload } = usePromptInput();
	return (
		<DropdownMenu>
			<PromptInputAction tooltip="Add attachment">
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-9 rounded-full text-foreground hover:bg-muted"
						aria-label="Add attachment"
						disabled={disabled}
					>
						<Plus className="size-4" />
					</Button>
				</DropdownMenuTrigger>
			</PromptInputAction>
			<DropdownMenuContent align="start" side="top" className="w-52">
				<DropdownMenuItem onSelect={onLibrarySelect}>
					<Library className="size-4" />
					From Library
				</DropdownMenuItem>
				<DropdownMenuItem onSelect={triggerFileUpload}>
					<MonitorUp className="size-4" />
					From computer
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
