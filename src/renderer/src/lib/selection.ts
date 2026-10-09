export function revealSelection(container: HTMLElement): void {
	if (container.closest('[data-state="closed"]')) return;
	const selected = container.querySelector<HTMLElement>(
		'[role="menuitemradio"][aria-checked="true"], [role="treeitem"][aria-selected="true"], [aria-current="page"]'
	);
	if (!selected) return;
	selected.scrollIntoView({ block: 'nearest' });
	if (container.querySelector('input, [role="textbox"]')) return;
	selected.focus({ preventScroll: true });
}
