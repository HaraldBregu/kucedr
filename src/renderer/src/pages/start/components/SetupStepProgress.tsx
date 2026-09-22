import React from 'react';
import { cn } from '@/lib/utils';
import { ONBOARDING_STEPS, ONBOARDING_STEP_TITLES } from '../setupConstants';
import type { OnboardingStep } from '../setupTypes';

type SetupStepProgressProps = {
	readonly currentStep: OnboardingStep;
};

export function SetupStepProgress({ currentStep }: SetupStepProgressProps): React.JSX.Element {
	const currentIndex = ONBOARDING_STEPS.indexOf(currentStep);
	const currentStepName = ONBOARDING_STEP_TITLES[currentStep];

	return (
		<div className="grid gap-1.5">
			<div className="flex items-center gap-1.5" aria-hidden="true">
				{ONBOARDING_STEPS.map((onboardingStep, index) => (
					<span
						key={onboardingStep}
						className={cn(
							'h-1.5 rounded-full transition-all duration-300',
							index === currentIndex
								? 'w-6 bg-primary'
								: index < currentIndex
									? 'w-1.5 bg-primary/50'
									: 'w-1.5 bg-muted'
						)}
					/>
				))}
			</div>
			<p
				className="truncate text-[11px] text-muted-foreground"
				role="status"
				aria-live="polite"
			>
				<span className="font-medium text-foreground">{currentStepName}</span>
				{` · ${currentIndex + 1} of ${ONBOARDING_STEPS.length}`}
			</p>
		</div>
	);
}
