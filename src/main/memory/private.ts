import { containsSecret } from '../agent/knowledge/secrets';

export function privateContent(text: string): boolean {
	return (
		containsSecret(text) ||
		/\b(?:password|passphrase|social security|credit card|bank account|iban|diagnos(?:is|ed)|medical record|sexual orientation|religious belief|political affiliation|codice fiscale|carta di credito|conto bancario|diagnosi)\b/i.test(
			text
		)
	);
}
