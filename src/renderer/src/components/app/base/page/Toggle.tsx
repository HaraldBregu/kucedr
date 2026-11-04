import type { CSSProperties, ReactElement } from 'react';
import { ArrowLeft, ArrowRight, PanelLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { usePageContext } from './hooks/use-page-context';

export function Toggle({ showTitle = false }: { showTitle?: boolean }): ReactElement {
	const { state, isMobile, toggleSidebar } = usePageContext();
	const navigate = useNavigate();
	return (
		<div className={`flex items-center -space-x-2 ${showTitle ? 'w-full' : ''}`}>
		<Button type="button" variant="ghost" size="icon" data-slot="split-pane-toggle"
			aria-label="Toggle Sidebar" aria-controls="split-pane-sidebar"
			aria-expanded={isMobile ? state.sidebarOpenMobile : state.sidebarOpen}
			title="Toggle Sidebar" onClick={toggleSidebar}
			className={`${showTitle ? '' : 'mr-2'} size-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground aria-expanded:bg-transparent aria-expanded:text-muted-foreground aria-expanded:hover:bg-muted aria-expanded:hover:text-foreground dark:aria-expanded:hover:bg-muted/50`}
			style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}>
			<PanelLeft className="size-4" strokeWidth={1.8} />
		</Button>
		{showTitle && <span className="ml-4 mr-3 text-sm font-medium">Kucedr</span>}
		{showTitle && <span className="min-w-0 flex-1" />}
		<Button type="button" variant="ghost" size="icon" aria-label="Go back" title="Go back"
			onClick={() => navigate(-1)}
			className="size-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
			style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}>
			<ArrowLeft className="size-4" strokeWidth={1.8} />
		</Button>
		<Button type="button" variant="ghost" size="icon" aria-label="Go forward" title="Go forward"
			onClick={() => navigate(1)}
			className="size-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
			style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}>
			<ArrowRight className="size-4" strokeWidth={1.8} />
		</Button>
		</div>
	);
}
