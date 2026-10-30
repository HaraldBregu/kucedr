import { PageContainer } from '@/components/app/base/page';
import LibraryContent from '../settings/pages/library/Page';

export default function LibraryPage(): React.JSX.Element {
	return (
		<PageContainer className="overflow-y-auto text-foreground">
			<LibraryContent />
		</PageContainer>
	);
}
