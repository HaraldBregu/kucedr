import { PageContainer } from '@/components/app/base/page';
import { NavigationBar } from '@/components/app/navigationbar/NavigationBar';
import LibraryContent from '../settings/pages/library/Page';

export default function LibraryPage(): React.JSX.Element {
	return (
		<PageContainer className="flex flex-col overflow-hidden text-foreground">
			<NavigationBar showWorkspace />
			<div className="min-h-0 flex-1 overflow-y-auto">
				<LibraryContent />
			</div>
		</PageContainer>
	);
}
