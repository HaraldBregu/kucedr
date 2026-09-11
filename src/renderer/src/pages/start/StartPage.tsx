import React, { useReducer } from 'react';
import { AlertCircle, ArrowRight, LoaderCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/contexts/useOnboarding';
import { SetupModelsStep } from './components/SetupModelsStep';
import { SetupProviderStep } from './components/SetupProviderStep';
import { SetupStepProgress } from './components/SetupStepProgress';
import {
	actionableProviderCatalog,
	getErrorMessage,
	getSelectedServiceModel,
	SETUP_STEPS,
	STEP_COPY,
} from './setupConstants';
import { useSetupModelServices } from './hooks/useSetupModelServices';
import { createInitialSetupState, setupReducer } from './state/setupReducer';
import type { OnboardingStep } from './setupTypes';
import { AuthStep } from './components/AuthStep';
import { LandingStep } from './components/LandingStep';

const StartPage: React.FC = () => {
	const navigate = useNavigate();
	const { state: authState, localOnly, requireSignIn } = useAuth();
	const { phase, start, restart, refreshConfiguration } = useOnboarding();
	const [state, dispatch] = useReducer(setupReducer, undefined, createInitialSetupState);
	const { step, serviceStates, loadingModels, savingConfig, errorMessage } = state;
	const { handleServiceChange, handleSaveModels } = useSetupModelServices(state, dispatch);
	const stepIndex = SETUP_STEPS.indexOf(step);
	const canContinueModels =
		getSelectedServiceModel(serviceStates.assistant) !== undefined &&
		!loadingModels &&
		!savingConfig;
	const isBusy = savingConfig;
	const currentStep: OnboardingStep =
		phase === 'auth' ? 'auth' : phase === 'setup' ? step : 'landing';

	function handleBack(): void {
		if (stepIndex === 0) {
			if (localOnly) requireSignIn();
			else restart();
			return;
		}

		const previousStep = SETUP_STEPS[stepIndex - 1];
		if (previousStep) dispatch({ type: 'GO_TO_STEP', step: previousStep });
	}

	function handleContinueModelProvider(): void {
		void window.provider
			.list('models')
			.then((storedProviders) => {
				const modelProviderIds = new Set(
					actionableProviderCatalog().map((provider) => provider.id)
				);
				const hasSavedKey = storedProviders.some(
					(provider) => modelProviderIds.has(provider.id) && Boolean(provider.apiKey.trim())
				);
				if (hasSavedKey) {
					dispatch({ type: 'GO_TO_STEP', step: 'search' });
				} else {
					dispatch({
						type: 'SET_ERROR',
						message: 'Add at least one model provider API key to continue.',
					});
				}
			})
			.catch((error) => {
				dispatch({
					type: 'SET_ERROR',
					message: getErrorMessage(error, 'Could not check saved provider access.'),
				});
			});
	}

	function handlePrimaryAction(): void {
		if (step === 'modelProvider') {
			handleContinueModelProvider();
			return;
		}

		if (step !== 'models') {
			const nextStep = SETUP_STEPS[stepIndex + 1];
			if (nextStep) dispatch({ type: 'GO_TO_STEP', step: nextStep });
			return;
		}

		void handleSaveModels().then(async (saved) => {
			if (!saved) return;
			const complete = await refreshConfiguration();
			if (complete) navigate('/home');
			else {
				dispatch({
					type: 'SET_ERROR',
					message: 'Your assistant configuration could not be verified.',
				});
			}
		});
	}

	function renderSetupStep(): React.JSX.Element {
		if (step === 'modelProvider') {
			return (
				<SetupProviderStep
					section="models"
					title={STEP_COPY.modelProvider.title}
					description={STEP_COPY.modelProvider.description}
				/>
			);
		}

		if (step === 'search') {
			return (
				<SetupProviderStep
					section="search"
					title={STEP_COPY.search.title}
					description={STEP_COPY.search.description}
				/>
			);
		}

		return (
			<SetupModelsStep
				serviceStates={serviceStates}
				loadingModels={loadingModels}
				savingConfig={savingConfig}
				onServiceChange={handleServiceChange}
			/>
		);
	}

	const content =
		phase === 'auth' ? (
			<AuthStep />
		) : phase === 'setup' ? (
			renderSetupStep()
		) : (
			<LandingStep
				loading={phase === 'checking' || authState.status === 'loading'}
				onStart={start}
			/>
		);

	return (
		<main className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
			<section className="min-h-0 flex-1 overflow-y-auto bg-background px-4 sm:px-6">
				{content}
				{phase === 'setup' && errorMessage ? (
					<div
						className="mx-auto mb-4 flex max-w-2xl items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-destructive"
						role="alert"
					>
						<AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
						<p className="min-w-0 break-words text-xs font-medium leading-4">{errorMessage}</p>
					</div>
				) : null}
			</section>

			{phase === 'setup' ? (
				<footer className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-card/60 px-3 py-2 sm:px-5">
					<SetupStepProgress currentStep={currentStep} />
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="outline"
							size="xs"
							disabled={isBusy}
							onClick={handleBack}
						>
							Back
						</Button>
						<Button
							type="button"
							size="sm"
							disabled={step === 'models' ? !canContinueModels : isBusy}
							onClick={handlePrimaryAction}
						>
							{isBusy ? 'Saving...' : stepIndex === SETUP_STEPS.length - 1 ? 'Finish' : 'Continue'}
							{isBusy ? (
								<LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
							) : (
								<ArrowRight className="size-3.5" aria-hidden="true" />
							)}
						</Button>
					</div>
				</footer>
			) : null}
		</main>
	);
};

export default StartPage;
