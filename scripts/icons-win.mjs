import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'resources/icons/icon-win.svg'));
const outputDirectory = path.join(root, 'resources/icons/win');
const icoSizes = [16, 24, 32, 48, 64, 128, 256];

await mkdir(outputDirectory, { recursive: true });

const icoImages = [];

for (const size of icoSizes) {
	icoImages.push(
		await sharp(source)
			.resize({
				width: size,
				height: size,
				fit: 'contain',
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			})
			.png({ compressionLevel: 9 })
			.toBuffer()
	);
}

const icoHeader = Buffer.alloc(6);
const icoDirectory = Buffer.alloc(icoSizes.length * 16);
let icoOffset = icoHeader.length + icoDirectory.length;

icoHeader.writeUInt16LE(0, 0);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(icoSizes.length, 4);

for (const [index, size] of icoSizes.entries()) {
	const image = icoImages[index];
	const entryOffset = index * 16;

	icoDirectory.writeUInt8(size === 256 ? 0 : size, entryOffset);
	icoDirectory.writeUInt8(size === 256 ? 0 : size, entryOffset + 1);
	icoDirectory.writeUInt8(0, entryOffset + 2);
	icoDirectory.writeUInt8(0, entryOffset + 3);
	icoDirectory.writeUInt16LE(1, entryOffset + 4);
	icoDirectory.writeUInt16LE(32, entryOffset + 6);
	icoDirectory.writeUInt32LE(image.length, entryOffset + 8);
	icoDirectory.writeUInt32LE(icoOffset, entryOffset + 12);
	icoOffset += image.length;
}

await writeFile(
	path.join(outputDirectory, 'icon.ico'),
	Buffer.concat([icoHeader, icoDirectory, ...icoImages])
);
