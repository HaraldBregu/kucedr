import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageContainer, Split } from '@/components/app/base/page';
import { CodeSidebar } from './Sidebar';
import { CodeSettings } from './Settings';

export default function CodePage(): React.JSX.Element {
	const { t } = useTranslation();
	const location = useLocation();
	const navigate = useNavigate();
	const codeLabel = t('navigationBar.code', 'Code');

	return (
		<PageContainer className="overflow-hidden text-foreground">
			<Split sidebar={<CodeSidebar title={codeLabel} />} sidebarLabel={codeLabel}>
				{location.pathname === '/code/settings' ? <CodeSettings onClose={() => navigate('/code')} /> : <div className="h-full min-h-0 flex-1" />}
			</Split>
		</PageContainer>
	);
}
