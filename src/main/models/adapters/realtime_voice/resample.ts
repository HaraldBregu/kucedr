export function createPcmResampler(): (input: Buffer) => Buffer {
	let carry = Buffer.alloc(0);
	let position = 0;
	return (input) => {
		const bytes = Buffer.concat([carry, input]);
		const samples = Math.floor(bytes.length / 2);
		const output: number[] = [];
		while (position < samples) {
			const index = Math.floor(position);
			const fraction = position - index;
			if (fraction && index + 1 >= samples) break;
			const first = bytes.readInt16LE(index * 2);
			const second = fraction ? bytes.readInt16LE((index + 1) * 2) : first;
			output.push(Math.round(first + (second - first) * fraction));
			position += 1.5;
		}
		const consumed = Math.min(Math.floor(position), samples);
		carry = bytes.subarray(consumed * 2);
		position -= consumed;
		const result = Buffer.alloc(output.length * 2);
		output.forEach((value, index) => result.writeInt16LE(value, index * 2));
		return result;
	};
}
