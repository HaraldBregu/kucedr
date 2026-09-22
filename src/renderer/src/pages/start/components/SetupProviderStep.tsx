import React from 'react';
import ProvidersPage, {
	type ProviderSetupSection,
} from '../../settings/pages/providers/Page';
import { SetupStepHeader } from './SetupStepHeader';

type SetupProviderStepProps = {
	readonly section: ProviderSetupSection;
	readonly title: string;
	readonly description: string;
};

export function SetupProviderStep({ section, title, description }: SetupProviderStepProps): React.JSX.Element {

	return (
		<div className="mx-auto flex min-h-full w-full max-w-2xl flex-col py-8">
			<SetupStepHeader title={title} description={description} />
			<div className="mt-6">
				<ProvidersPage embedded section={section} />
			</div>
		</div>
	);
}
