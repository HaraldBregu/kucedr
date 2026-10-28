import type { CSSProperties, ReactElement } from 'react';
import { PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePageContext } from './hooks/use-page-context';

export function Toggle(): ReactElement {
	const { state, isMobile, toggleSidebar } = usePageContext();
	return (
		<Button type="button" variant="ghost" size="icon" data-slot="split-pane-toggle"
			aria-label="Toggle Sidebar" aria-controls="split-pane-sidebar"
			aria-expanded={isMobile ? state.sidebarOpenMobile : state.sidebarOpen}
			title="Toggle Sidebar" onClick={toggleSidebar}
			className="size-8 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
			style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}>
			<PanelLeft className="size-4" strokeWidth={1.8} />
		</Button>
	);
}
