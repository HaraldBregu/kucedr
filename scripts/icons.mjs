import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'resources/icons/icon.svg'));
const sourceWithoutBackground = source.toString().replace(/\s*<rect id="app-background"[^>]*\/>/, '');

if (sourceWithoutBackground === source.toString()) {
	throw new Error('Missing app-background rectangle in resources/icons/icon.svg.');
}

const outputDirectory = path.join(root, 'resources/icons/png');
const macOutputDirectory = path.join(root, 'resources/icons/mac');
const pngSizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const rendered = new Map();
const appRendered = new Map();

await mkdir(outputDirectory, { recursive: true });
await mkdir(macOutputDirectory, { recursive: true });

for (const size of pngSizes) {
	const appIcon = await sharp(source)
		.resize({
			width: size,
			height: size,
			fit: 'contain',
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		})
		.png({ compressionLevel: 9 })
		.toBuffer();
	const icon = await sharp(Buffer.from(sourceWithoutBackground))
		.resize({
			width: size,
			height: size,
			fit: 'contain',
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		})
		.png({ compressionLevel: 9 })
		.toBuffer();

	rendered.set(size, icon);
	appRendered.set(size, appIcon);
	if (pngSizes.includes(size)) {
		await writeFile(path.join(outputDirectory, `${size}x${size}.png`), icon);
	}
}

await writeFile(path.join(root, 'resources/icons/icon.png'), rendered.get(1024));

const { data: trayTemplatePixels, info: trayTemplateInfo } = await sharp(
	Buffer.from(sourceWithoutBackground)
)
	.resize({
		width: 32,
		height: 32,
		fit: 'contain',
		background: { r: 0, g: 0, b: 0, alpha: 0 },
	})
	.ensureAlpha()
	.raw()
	.toBuffer({ resolveWithObject: true });

for (let index = 0; index < trayTemplatePixels.length; index += trayTemplateInfo.channels) {
	trayTemplatePixels[index] = 255;
	trayTemplatePixels[index + 1] = 255;
	trayTemplatePixels[index + 2] = 255;
}

const trayTemplate = await sharp(trayTemplatePixels, {
	raw: {
		width: trayTemplateInfo.width,
		height: trayTemplateInfo.height,
		channels: trayTemplateInfo.channels,
	},
})
	.png({ compressionLevel: 9 })
	.toBuffer();

await writeFile(path.join(macOutputDirectory, 'trayTemplate.png'), trayTemplate);

const icoSizes = pngSizes.filter((size) => size <= 256);
const icoHeader = Buffer.alloc(6);
const icoDirectory = Buffer.alloc(icoSizes.length * 16);
const icoImages = icoSizes.map((size) => rendered.get(size));
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
	path.join(root, 'resources/icons/win/icon.ico'),
	Buffer.concat([icoHeader, icoDirectory, ...icoImages])
);

const icnsRepresentations = [
	['icp4', 16],
	['icp5', 32],
	['icp6', 64],
	['ic07', 128],
	['ic08', 256],
	['ic09', 512],
	['ic10', 1024],
	['ic11', 32],
	['ic12', 64],
	['ic13', 256],
	['ic14', 512],
];
const icnsChunks = icnsRepresentations.map(([type, size]) => {
	const image = appRendered.get(size);
	const chunk = Buffer.alloc(8 + image.length);

	chunk.write(type, 0, 4, 'ascii');
	chunk.writeUInt32BE(chunk.length, 4);
	image.copy(chunk, 8);
	return chunk;
});
const icnsHeader = Buffer.alloc(8);

icnsHeader.write('icns', 0, 4, 'ascii');
icnsHeader.writeUInt32BE(8 + icnsChunks.reduce((total, chunk) => total + chunk.length, 0), 4);

await writeFile(
	path.join(root, 'resources/icons/mac/icon.icns'),
	Buffer.concat([icnsHeader, ...icnsChunks])
);
