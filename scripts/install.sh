#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null || [ "$(node -p 'Number(process.versions.node.split(".")[0]) >= 22')" != true ]; then
	echo 'Node.js 22 or newer is required.' >&2
	exit 1
fi

case "$(uname -s)" in
	Darwin) platform=darwin ;;
	Linux) platform=linux ;;
	MINGW*|MSYS*|CYGWIN*) platform=win32 ;;
	*) echo 'This OS is not supported.' >&2; exit 1 ;;
esac

case "$(uname -m)" in
	x86_64|amd64) arch=x64 ;;
	arm64|aarch64) arch=arm64 ;;
	*) echo 'This CPU architecture is not supported.' >&2; exit 1 ;;
esac
if [ "$arch" = arm64 ] && [ "$platform" != darwin ]; then
	echo "No portable Kucedr build is configured for $platform/$arch." >&2
	exit 1
fi

temporary="$(mktemp -d)"
mounted=0
trap 'if [ "$mounted" -eq 1 ]; then hdiutil detach "$temporary/mount" >/dev/null; fi; rm -rf "$temporary"' EXIT
curl -fsSL --retry 3 \
	-H 'Accept: application/vnd.github+json' \
	-H 'User-Agent: kucedr-portable-installer' \
	-o "$temporary/releases.json" \
	'https://api.github.com/repos/HaraldBregu/kucedr/releases?per_page=100'
releases_file="$temporary/releases.json"
if [ "$platform" = win32 ]; then releases_file="$(cygpath -w "$releases_file")"; fi
asset_info="$(
	KUCEDR_PLATFORM="$platform" KUCEDR_ARCH="$arch" KUCEDR_RELEASES="$releases_file" node -e '
			const releases = JSON.parse(require("node:fs").readFileSync(process.env.KUCEDR_RELEASES, "utf8"));
			const release = releases
				.filter(item => item.assets.some(asset => asset.name.startsWith("Kucedr-")))
				.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))[0];
			if (!release) {
				console.error("No Kucedr release assets are published yet. Existing Friday releases are not portable Kucedr builds.");
				process.exit(1);
			}
			const version = release.tag_name.replace(/^v/, "");
			const platform = process.env.KUCEDR_PLATFORM;
			const arch = process.env.KUCEDR_ARCH;
			const name = platform === "win32" ? `Kucedr-Portable-${version}-x64.exe`
				: platform === "darwin" ? `Kucedr-${version}-${arch}.dmg`
				: `Kucedr-${version}.AppImage`;
			const asset = release.assets.find(item => item.name === name);
			if (!asset) {
				console.error(`${release.tag_name} has no portable build for ${platform}/${arch} (${name}).`);
				process.exit(1);
			}
			console.log(`${asset.name}\t${asset.browser_download_url}\t${asset.size}`);
		'
)"
IFS=$'\t' read -r asset_name asset_url asset_size <<< "$asset_info"

download="$temporary/$asset_name"
echo "Downloading $asset_name..."
curl -fL --retry 3 -o "$download" "$asset_url"
if [ "$(wc -c < "$download" | tr -d '[:space:]')" != "$asset_size" ]; then
	echo "Incomplete download of $asset_name." >&2
	exit 1
fi

case "$platform" in
	darwin)
		mkdir "$temporary/mount"
		hdiutil attach "$download" -nobrowse -readonly -mountpoint "$temporary/mount"
		mounted=1
		if [ ! -d "$temporary/mount/Kucedr.app" ]; then
			echo "$asset_name does not contain Kucedr.app." >&2
			exit 1
		fi
		mkdir -p "$HOME/Applications"
		ditto "$temporary/mount/Kucedr.app" "$HOME/Applications/Kucedr.app"
		location="$HOME/Applications/Kucedr.app"
		;;
	win32)
		local_app_data="$(cygpath -u "${LOCALAPPDATA:-$HOME/AppData/Local}")"
		location="$local_app_data/Programs/Kucedr/Kucedr.exe"
		mkdir -p "${location%/*}"
		cp "$download" "$location.new"
		mv -f "$location.new" "$location"
		;;
	linux)
		location="$HOME/.local/bin/Kucedr.AppImage"
		mkdir -p "${location%/*}"
		cp "$download" "$location.new"
		chmod +x "$location.new"
		mv -f "$location.new" "$location"
		;;
esac

echo "Installed $location"
