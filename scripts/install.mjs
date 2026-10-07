import { createWriteStream } from 'node:fs';
import { chmod, copyFile, mkdir, mkdtemp, readdir, rename, rm, stat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFileSync } from 'node:child_process';

async function install() {
	const platform = process.platform;
	const arch = process.arch;
	if (!['win32', 'darwin', 'linux'].includes(platform) || (arch !== 'x64' && !(platform === 'darwin' && arch === 'arm64'))) {
		throw new Error(`No portable Kucedr build is configured for ${platform}/${arch}.`);
	}

	const response = await fetch('https://api.github.com/repos/HaraldBregu/kucedr/releases?per_page=100', {
		headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'kucedr-portable-installer' }
	});
	if (!response.ok) throw new Error(`GitHub releases request failed: HTTP ${response.status}.`);
	const releases = await response.json();
	const release = releases
		.filter((item) => item.assets.some((asset) => asset.name.startsWith('Kucedr-')))
		.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))[0];
	if (!release) throw new Error('No Kucedr release assets are published yet. The existing Friday releases are not portable Kucedr builds.');

	const version = release.tag_name.replace(/^v/, '');
	const name = platform === 'win32'
		? `Kucedr-Portable-${version}-x64.exe`
		: platform === 'darwin'
			? `Kucedr-${version}-${arch}.dmg`
			: `Kucedr-${version}.AppImage`;
	const asset = release.assets.find((item) => item.name === name);
	if (!asset) throw new Error(`${release.tag_name} has no portable build for ${platform}/${arch} (${name}).`);

	const temporary = await mkdtemp(join(tmpdir(), 'kucedr-install-'));
	const download = join(temporary, basename(name));
	let mounted = false;
	try {
		console.log(`Downloading ${name}...`);
		const artifact = await fetch(asset.browser_download_url, { headers: { 'User-Agent': 'kucedr-portable-installer' } });
		if (!artifact.ok || !artifact.body) throw new Error(`Download failed: HTTP ${artifact.status}.`);
		await pipeline(Readable.fromWeb(artifact.body), createWriteStream(download));
		if ((await stat(download)).size !== asset.size) throw new Error(`Incomplete download of ${name}.`);

		if (platform === 'darwin') {
			const mount = join(temporary, 'mounted');
			await mkdir(mount);
			execFileSync('hdiutil', ['attach', download, '-nobrowse', '-readonly', '-mountpoint', mount], { stdio: 'inherit' });
			mounted = true;
			const app = (await readdir(mount)).find((entry) => entry === 'Kucedr.app');
			if (!app) throw new Error(`${name} does not contain Kucedr.app.`);
			const destination = join(homedir(), 'Applications', app);
			await mkdir(join(homedir(), 'Applications'), { recursive: true });
			execFileSync('ditto', [join(mount, app), destination], { stdio: 'inherit' });
			console.log(`Installed ${destination}`);
		} else {
			const destination = platform === 'win32'
				? join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'Programs', 'Kucedr', 'Kucedr.exe')
				: join(homedir(), '.local', 'bin', 'Kucedr.AppImage');
			await mkdir(join(destination, '..'), { recursive: true });
			const pending = `${destination}.new`;
			await copyFile(download, pending);
			if (platform === 'linux') await chmod(pending, 0o755);
			await rename(pending, destination);
			console.log(`Installed ${destination}`);
		}
	} finally {
		if (mounted) execFileSync('hdiutil', ['detach', join(temporary, 'mounted')], { stdio: 'inherit' });
		await rm(temporary, { recursive: true, force: true });
	}
}

install().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
