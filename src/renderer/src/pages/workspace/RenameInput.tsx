import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';

interface WorkspaceRenameInputProps {
	readonly name: string;
	readonly busy: boolean;
	readonly onCancel: () => void;
	readonly onConfirm: (name: string) => void;
}

export function WorkspaceRenameInput({
	name,
	busy,
	onCancel,
	onConfirm,
}: WorkspaceRenameInputProps): React.JSX.Element {
	const { t } = useTranslation();
	const [value, setValue] = useState(name);
	return (
		<Input
			autoFocus
			aria-label={t('workspaceSidebar.name', 'Name')}
			className="h-7 min-w-0 flex-1 px-2 text-sm"
			disabled={busy}
			value={value}
			onChange={(event) => setValue(event.target.value)}
			onClick={(event) => event.stopPropagation()}
			onContextMenu={(event) => event.stopPropagation()}
			onBlur={() => onConfirm(value.trim())}
			onKeyDown={(event) => {
				if (event.key === 'Escape') {
					event.preventDefault();
					event.stopPropagation();
					onCancel();
				} else if (event.key === 'Enter') {
					event.preventDefault();
					event.stopPropagation();
					onConfirm(value.trim());
				} else {
					event.stopPropagation();
				}
			}}
		/>
	);
}
