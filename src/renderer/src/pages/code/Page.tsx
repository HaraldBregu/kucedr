import { useTranslation } from 'react-i18next';
import { PageContainer, Split } from '@/components/app/base/page';
import { CodeSidebar } from './Sidebar';

export default function CodePage(): React.JSX.Element {
	const { t } = useTranslation();
	const codeLabel = t('navigationBar.code', 'Code');

	return (
		<PageContainer className="overflow-hidden text-foreground">
			<Split sidebar={<CodeSidebar title={codeLabel} />} sidebarLabel={codeLabel}>
				<div className="h-full min-h-0 flex-1" />
			</Split>
		</PageContainer>
	);
}
