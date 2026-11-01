import type { CSSProperties, ReactElement } from 'react';
import { ChevronLeft, ChevronRight, PanelLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { usePageContext } from './hooks/use-page-context';

export function Toggle(): ReactElement {
	const { state, isMobile, toggleSidebar } = usePageContext();
	const navigate = useNavigate();
	return (
		<>
		<Button type="button" variant="ghost" size="icon" data-slot="split-pane-toggle"
			aria-label="Toggle Sidebar" aria-controls="split-pane-sidebar"
			aria-expanded={isMobile ? state.sidebarOpenMobile : state.sidebarOpen}
			title="Toggle Sidebar" onClick={toggleSidebar}
			className="size-8 shrink-0 rounded-md text-muted-foreground hover:text-foreground aria-expanded:bg-transparent aria-expanded:text-muted-foreground"
			style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}>
			<PanelLeft className="size-4" strokeWidth={1.8} />
		</Button>
		<Button type="button" variant="ghost" size="icon" aria-label="Go back" title="Go back"
			onClick={() => navigate(-1)}
			className="size-8 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
			style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}>
			<ChevronLeft className="size-4" strokeWidth={1.8} />
		</Button>
		<Button type="button" variant="ghost" size="icon" aria-label="Go forward" title="Go forward"
			onClick={() => navigate(1)}
			className="size-8 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
			style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}>
			<ChevronRight className="size-4" strokeWidth={1.8} />
		</Button>
		</>
	);
}
