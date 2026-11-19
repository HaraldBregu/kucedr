import type { ReactElement } from 'react';
import type { BrowserPaneTab } from '../../../../../shared/browser';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function BrowserTabs({
	tabs,
	active,
	onSelect,
}: {
	readonly tabs: readonly BrowserPaneTab[];
	readonly active: string;
	readonly onSelect: (targetId: string) => void;
}): ReactElement {
	return (
		<Tabs value={active} onValueChange={(value) => onSelect(String(value))} className="shrink-0">
			<TabsList variant="line" aria-label="Browser tabs" className="w-full justify-start overflow-x-auto px-2">
				{tabs.map((tab) => (
					<TabsTrigger key={tab.targetId} value={tab.targetId} className="max-w-44 flex-none text-xs">
						<span className="truncate">{tab.title || tab.url}</span>
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	);
}
