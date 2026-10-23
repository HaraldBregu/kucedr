import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// ponytail: archiver v8 is pure ESM; this CJS stand-in writes uncompressed (stored) ZIPs.
export class ZipArchive extends EventEmitter {
	private entries: { name: string; data: Buffer }[] = [];
	private output?: NodeJS.WritableStream;

	pipe(output: NodeJS.WritableStream): NodeJS.WritableStream {
		this.output = output;
		return output;
	}

	file(source: string, { name }: { name: string }): this {
		this.entries.push({ name, data: fs.readFileSync(source) });
		return this;
	}

	directory(source: string, name: string): this {
		for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
			const child = path.join(source, entry.name);
			if (entry.isDirectory()) this.directory(child, `${name}/${entry.name}`);
			else if (entry.isFile()) this.file(child, { name: `${name}/${entry.name}` });
		}
		return this;
	}

	async finalize(): Promise<void> {
		const local: Buffer[] = [];
		const central: Buffer[] = [];
		let offset = 0;
		for (const { name, data } of this.entries) {
			const fileName = Buffer.from(name);
			const crc = zlib.crc32(data);
			const header = Buffer.alloc(30);
			header.writeUInt32LE(0x04034b50, 0);
			header.writeUInt16LE(20, 4);
			header.writeUInt32LE(crc, 14);
			header.writeUInt32LE(data.length, 18);
			header.writeUInt32LE(data.length, 22);
			header.writeUInt16LE(fileName.length, 26);
			const record = Buffer.alloc(46);
			record.writeUInt32LE(0x02014b50, 0);
			record.writeUInt16LE(20, 4);
			record.writeUInt16LE(20, 6);
			record.writeUInt32LE(crc, 16);
			record.writeUInt32LE(data.length, 20);
			record.writeUInt32LE(data.length, 24);
			record.writeUInt16LE(fileName.length, 28);
			record.writeUInt32LE(offset, 42);
			local.push(header, fileName, data);
			central.push(record, fileName);
			offset += header.length + fileName.length + data.length;
		}
		const directory = Buffer.concat(central);
		const end = Buffer.alloc(22);
		end.writeUInt32LE(0x06054b50, 0);
		end.writeUInt16LE(this.entries.length, 8);
		end.writeUInt16LE(this.entries.length, 10);
		end.writeUInt32LE(directory.length, 12);
		end.writeUInt32LE(offset, 16);
		this.output?.end(Buffer.concat([...local, directory, end]));
	}
}
