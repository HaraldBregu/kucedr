import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Space } from '@/pages/home/Space';
import { useSpaces } from '@/spaces/context';

export function WorkspaceSwitcher(): React.JSX.Element | null {
	const { t } = useTranslation();
	const { current, workspaces, select } = useSpaces();
	const [error, setError] = useState('');
	const workspace = workspaces.find((item) => item.id === current);
	if (!workspace) return null;
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button type="button" variant="ghost" size="sm" className="max-w-56 shrink rounded-full px-2.5 text-muted-foreground" aria-label={t('spaces.switch')}>
					<Space workspace={workspace} showAvatarLabel={false} smallAvatar />
					<ChevronsUpDown className="size-3.5 shrink-0" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-56">
				{workspaces.map((item) => (
					<DropdownMenuItem key={item.id} onSelect={() => {
						if (item.id === current) return;
						setError('');
						void select(item.id).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)));
					}}>
						<Space workspace={item} />
						{item.id === current && <Check />}
					</DropdownMenuItem>
				))}
				{error && <p role="alert" className="px-2 py-1 text-xs text-destructive">{error}</p>}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
