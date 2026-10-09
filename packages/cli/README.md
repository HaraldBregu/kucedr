# @kucedr/cli

Launch the Kucedr desktop assistant, install plugin packages, and use an interactive terminal interface.
See the [project overview](../../README.md) for the desktop app and [Plugins](../../docs/PLUGINS.md)
for extension capabilities and activation limits.

## Install

```sh
npm install --global @kucedr/cli
```

Node.js 22.12 or newer is required.

## Commands

```sh
kucedr                         # Launch the Kucedr desktop app
kucedr app                     # Launch the Kucedr desktop app explicitly
kucedr install package-one     # Install a Kucedr plugin from npm
kucedr install ./my-plugin     # Install a local plugin directory
kucedr install package-one -f  # Replace an installed plugin with the same id
kucedr tui                     # Open the interactive terminal interface
```

Inside `kucedr tui`, use:

```text
/install package-one
/app
/help
/clear
/quit
```

`/install` is a TUI command. In a normal shell, use `kucedr install <package>`.

## Plugin installation

The package spec is resolved with `npm pack --ignore-scripts`. No package lifecycle scripts are run.
The archive must contain a Kucedr plugin `manifest.json`. Its manifest ID determines the install
folder:

```text
<CLI data directory>/plugins/<plugin-id>/
```

The CLI data directory defaults to:

| Platform | Directory                                                   |
| -------- | ----------------------------------------------------------- |
| macOS    | `~/Library/Application Support/Kucedr`                      |
| Windows  | `%APPDATA%/Kucedr`                                          |
| Linux    | `$XDG_CONFIG_HOME/Kucedr`, or `~/.config/Kucedr` when unset |

The desktop's personal profile is separate, under `~/.kucedr`.

The manifest and every contributed file are validated before the staged directory is renamed into
place. Existing plugins are left untouched unless `--force` is passed. The current desktop runtime
does not scan this directory or activate its contributions, even after a restart. The CLI still
prints a restart prompt after installation. See [Plugins](../../docs/PLUGINS.md) for the runtime
paths that work today.

Use `--data-dir <path>` to target a non-default Kucedr data directory. Use `KUCEDR_APP_PATH` when the
desktop executable is in a custom location, including a downloaded Linux AppImage.

## Development

Repository development requires Node.js 22.19+ and npm 11.5.1+; see the
[development guide](../../docs/DEVELOPMENT.md). Run these commands from the repository root:

```sh
npm ci
npm run typecheck --workspace @kucedr/cli
npm run cli:test
npm run cli:build
npm link ./packages/cli
```

CLI releases use `cli-v<version>` tags and npm trusted publishing. See the repository
[development and deployment guide](../../docs/DEVELOPMENT.md#release-the-cli).
