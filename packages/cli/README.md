# @kucedr/cli

Command-line and terminal interface for Kucedr.

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

The manifest and every contributed file are validated before the staged directory is renamed into
place. Existing plugins are left untouched unless `--force` is passed. The current desktop runtime
does not scan this directory or activate its contributions, even after a restart. The CLI still
prints a restart prompt after installation. See [Plugins](../../docs/PLUGINS.md) for the runtime
paths that work today.

Use `--data-dir <path>` to target a non-default Kucedr data directory. Use `KUCEDR_APP_PATH` when the
desktop executable is in a custom location, including a downloaded Linux AppImage.

## Development

Run these commands from the repository root:

```sh
npm ci
npm run typecheck --workspace @kucedr/cli
npm run cli:test
npm run cli:build
npm link ./packages/cli
```

CLI releases use `cli-v<version>` tags and npm trusted publishing. See the repository
[development and deployment guide](../../docs/DEVELOPMENT.md#release-the-cli).
