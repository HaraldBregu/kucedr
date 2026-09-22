import React from 'react';
import { AlertCircle } from 'lucide-react';
import i18next from 'i18next';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import {
	Empty,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
	EmptyDescription,
	EmptyContent,
} from '@/components/ui/empty';

interface ErrorBoundaryProps {
	children: React.ReactNode;
	fallback?: React.ReactNode;
	onReset?: () => void;
	level?: 'root' | 'route' | 'feature';
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
		console.error('[ErrorBoundary]', error, errorInfo);
	}

	handleReset = (): void => {
		this.setState({ hasError: false, error: null });
		this.props.onReset?.();
	};

	render(): React.ReactNode {
		if (!this.state.hasError) {
			return this.props.children;
		}

		if (this.props.fallback) {
			return this.props.fallback;
		}

		const { level = 'feature' } = this.props;

		const t = (key: string): string => i18next.t(key);

		if (level === 'root') {
			return (
				<div className="app-translucent-window flex h-screen w-full items-center justify-center">
					<Empty>
						<EmptyHeader>
							<EmptyMedia>
								<AlertCircle className="h-12 w-12 text-destructive" />
							</EmptyMedia>
							<EmptyTitle>{t('errorBoundary.rootTitle')}</EmptyTitle>
							<EmptyDescription>{t('errorBoundary.rootMessage')}</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<p className="text-xs text-muted-foreground/60 font-mono break-all">
								{this.state.error?.message}
							</p>
							<button
								type="button"
								onClick={() => window.location.reload()}
								className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
							>
								{t('errorBoundary.restartApp')}
							</button>
						</EmptyContent>
					</Empty>
				</div>
			);
		}

		if (level === 'route') {
			return (
				<div className="flex h-full w-full flex-1 items-center justify-center">
					<Empty>
						<EmptyHeader>
							<EmptyMedia>
								<AlertCircle className="h-10 w-10 text-destructive" />
							</EmptyMedia>
							<EmptyTitle>{t('errorBoundary.routeTitle')}</EmptyTitle>
							<EmptyDescription>{t('errorBoundary.routeMessage')}</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<p className="text-xs text-muted-foreground/60 font-mono break-all">
								{this.state.error?.message}
							</p>
							<div className="flex gap-2 justify-center">
								<button
									type="button"
									onClick={this.handleReset}
									className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
								>
									{t('errorBoundary.tryAgainButton')}
								</button>
								<button
									type="button"
									onClick={() => {
										window.location.hash = '#/home';
									}}
									className="px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-colors"
								>
									{t('errorBoundary.goHome')}
								</button>
							</div>
						</EmptyContent>
					</Empty>
				</div>
			);
		}

		// feature level
		return (
			<Empty className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
				<EmptyHeader>
					<EmptyMedia>
						<AlertCircle className="h-4 w-4 text-destructive" />
					</EmptyMedia>
					<EmptyTitle className="text-destructive">{t('errorBoundary.featureTitle')}</EmptyTitle>
				</EmptyHeader>
				<EmptyContent>
					<p className="text-xs text-muted-foreground font-mono break-all">
						{this.state.error?.message}
					</p>
					<button
						type="button"
						onClick={this.handleReset}
						className="text-xs text-primary hover:text-primary/80 transition-colors"
					>
						{t('errorBoundary.tryAgain')}
					</button>
				</EmptyContent>
			</Empty>
		);
	}
}

export function RouteErrorElement(): React.JSX.Element {
	const error = useRouteError();
	const t = (key: string): string => i18next.t(key);

	let title: string;
	let message: string;
	let detail: string;

	if (isRouteErrorResponse(error)) {
		title =
			error.status === 404
				? t('errorBoundary.notFoundTitle')
				: t('errorBoundary.routeTitle');
		message =
			error.status === 404
				? t('errorBoundary.notFoundMessage')
				: t('errorBoundary.routeMessage');
		detail = `${error.status} ${error.statusText}${
			typeof error.data === 'string' ? ` — ${error.data}` : ''
		}`;
	} else if (error instanceof Error) {
		title = t('errorBoundary.routeTitle');
		message = t('errorBoundary.routeMessage');
		detail = error.message;
	} else {
		title = t('errorBoundary.routeTitle');
		message = t('errorBoundary.routeMessage');
		detail = String(error);
	}

	return (
		<div className="flex h-full w-full flex-1 items-center justify-center">
			<Empty>
				<EmptyHeader>
					<EmptyMedia>
						<AlertCircle className="h-10 w-10 text-destructive" />
					</EmptyMedia>
					<EmptyTitle>{title}</EmptyTitle>
					<EmptyDescription>{message}</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<p className="text-xs text-muted-foreground/60 font-mono break-all">{detail}</p>
					<button
						type="button"
						onClick={() => {
							window.location.hash = '#/home';
						}}
						className="px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-colors"
					>
						{t('errorBoundary.goHome')}
					</button>
				</EmptyContent>
			</Empty>
		</div>
	);
}
