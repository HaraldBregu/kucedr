import type { CatalogModel } from '../../../../shared/model_types';

export function modelEndpoint(stored: string | undefined, model: CatalogModel | undefined): string {
	const rule = model?.metadata?.baseUrlRule;
	if (stored && (!rule || new RegExp(rule.pattern, 'i').test(stored))) return stored;
	return model?.url ?? '';
}
