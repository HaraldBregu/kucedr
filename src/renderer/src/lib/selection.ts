export function revealSelection(container: HTMLElement): boolean {
	if (container.closest('[data-state="closed"]')) return false;
	const selected = container.querySelector<HTMLElement>(
		'[role="menuitemradio"][aria-checked="true"], [role="treeitem"][aria-selected="true"], [aria-current="page"]'
	);
	if (!selected) return false;
	selected.scrollIntoView({ block: 'nearest' });
	if (container.querySelector('input, [role="textbox"]')) return false;
	selected.focus({ preventScroll: true });
	return true;
}
