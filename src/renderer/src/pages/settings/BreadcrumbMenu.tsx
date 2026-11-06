import React from 'react';
import { ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { playSound } from '@/lib/sounds/play';

interface BreadcrumbMenuProps {
	readonly label: string;
	readonly activePath: string;
	readonly options: readonly { readonly path: string; readonly label: string }[];
	readonly showArrow?: boolean;
}

export function BreadcrumbMenu({ label, activePath, options, showArrow = true }: BreadcrumbMenuProps): React.JSX.Element {
	const navigate = useNavigate();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button type="button" variant="ghost" size="sm" className="h-6 max-w-48 min-w-0 gap-1 px-1.5 text-xs font-medium">
					<span className="truncate">{label}</span>
					{showArrow && <ChevronDown aria-hidden="true" className="size-3 shrink-0" />}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="max-h-80 min-w-48 overflow-y-auto">
				{options.map((option) => (
					<DropdownMenuItem
						key={option.path}
						aria-current={option.path === activePath ? 'page' : undefined}
						className="text-xs font-medium aria-[current=page]:bg-accent"
						onSelect={() => {
							playSound('navigate');
							navigate(option.path);
						}}
					>
						{option.label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
