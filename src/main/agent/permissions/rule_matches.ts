import type { PermissionRule } from './permissions_types';
import { samePathOrWithin } from './same_path_or_within';

export function ruleMatches(rule: PermissionRule, target: string): boolean {
	return (
		samePathOrWithin(target, rule.root) && (rule.recursive || samePathOrWithin(rule.root, target))
	);
}
