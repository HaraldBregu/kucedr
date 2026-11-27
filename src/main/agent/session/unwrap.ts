import { UNTRUSTED_TAG } from '../runner/untrusted';

const ENVELOPE = new RegExp(`^<${UNTRUSTED_TAG} source="[^"]*">\\n([\\s\\S]*)\\n</${UNTRUSTED_TAG}>$`);

export function unwrap(text: string): string {
	return ENVELOPE.exec(text)?.[1] ?? text;
}
