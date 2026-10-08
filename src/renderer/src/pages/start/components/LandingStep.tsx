import React from 'react';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import './landing.css';

type LandingStepProps = {
	readonly loading: boolean;
	readonly onStart: () => void;
};

export function LandingStep({ loading, onStart }: LandingStepProps): React.JSX.Element {
	return (
		<div className="landing mx-auto flex min-h-full w-full max-w-xl flex-col items-center justify-center px-4 py-10 text-center sm:px-6">
			<div className="landing-brand flex shrink-0 flex-col items-center">
				<span
					className="landing-logo size-20 shrink-0 bg-primary"
					role="img"
					aria-label="Kucedr logo"
				/>
				<p className="mt-6 font-heading text-5xl font-black leading-none tracking-[-0.055em] text-primary">
					Kucedr
				</p>
			</div>
			<div className="landing-content grid w-full grid-rows-[1fr]">
				<div className="flex min-h-0 flex-col items-center">
					<h1 className="mt-5 max-w-sm text-balance text-3xl font-medium leading-snug tracking-tight text-foreground">
						One personal assistant.
						<br />
						Unlimited tools.
					</h1>
					<Button
						className="mt-8 h-10 min-w-60 gap-2 px-5 hover:bg-primary/90"
						size="lg"
						disabled={loading}
						aria-busy={loading}
						onClick={onStart}
					>
						{loading ? (
							<LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
						) : null}
						{loading ? 'Checking your session…' : 'Get started'}
						{loading ? null : (
							<ArrowRight
								className="size-4 motion-safe:transition-transform motion-safe:duration-150 motion-safe:group-hover/button:translate-x-1 motion-safe:group-focus-visible/button:translate-x-1"
								aria-hidden="true"
							/>
						)}
					</Button>
				</div>
			</div>
		</div>
	);
}
