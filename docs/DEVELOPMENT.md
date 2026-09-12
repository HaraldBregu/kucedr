# Development, Testing, and Deployment

This is the canonical workflow for developing, testing, pushing, and deploying Kucedr from
the monorepo.

Kucedr contains three independently versioned products:

| Product      | Manifest                    | Workspace name | Deployment destination |
| ------------ | --------------------------- | -------------- | ---------------------- |
| Electron app | `package.json`              | root package   | GitHub Releases        |
| SDK          | `packages/sdk/package.json` | `@kucedr/sdk`  | npm                    |
| CLI          | `packages/cli/package.json` | `@kucedr/cli`  | npm                    |

The private root package manages the Electron application and both npm workspaces through
one root `package-lock.json`. `packages/examples/projects` is a standalone example and
intentionally keeps its own lockfile.

## Prerequisites

Install:

- Git
- Node.js 22.19 or newer
- npm 11.5.1 or newer

Confirm the active versions from the repository root:

```sh
node --version
npm --version
git --version
```

The repository declares npm `11.13.0` in `packageManager`. Use that version when changing
dependencies or regenerating the lockfile:

```sh
npm install --global npm@11.13.0
```

## First-time setup

Clone the repository and install all root and workspace dependencies:

```sh
git clone https://github.com/HaraldBregu/kucedr.git
cd kucedr
npm ci
```

`npm ci` uses the committed lockfile, links `@kucedr/sdk` and `@kucedr/cli` as local
workspaces, and rebuilds Electron native dependencies through the root `postinstall`
script.

Use `npm install` instead of `npm ci` only when intentionally adding, removing, or updating
dependencies. Commit both the affected `package.json` and the root `package-lock.json`.
Do not create lockfiles inside `packages/sdk` or `packages/cli`.

## Run the Electron app for development

Start the normal development environment:

```sh
npm run dev
```

This starts electron-vite with hot reload, sourcemaps, and the main-process inspector.
Stop it with `Ctrl+C`.

Available application modes:

| Command                     | Mode        | Use case                                            |
| --------------------------- | ----------- | --------------------------------------------------- |
| `npm run dev`               | development | Normal local development                            |
| `npm run dev:staging`       | staging     | Verify staging configuration                        |
| `npm run dev:prod`          | production  | Exercise production configuration without packaging |
| `npm run dev-linux`         | development | Linux host that requires the sandbox override       |
| `npm run dev-linux:staging` | staging     | Staging with the Linux sandbox override             |
| `npm run dev-linux:prod`    | production  | Production with the Linux sandbox override          |

The `dev:*` commands always run a live development server; they do not create installers.
The `dev-linux*` commands disable Electron's sandbox and are only for local hosts where the
normal command cannot start. Do not use that override for production distribution.

Kucedr reads an optional root `.env` file when the Electron main process starts. Keep
local credentials in `.env`; the file is ignored by Git. Provider credentials can also be
configured from the application settings.

See [Account and Cloud Architecture](CLOUD.md) for the provider-neutral boundaries and
[Supabase Adapter](SUPABASE.md) for the current infrastructure-specific development setup.

### Develop the SDK

Build or test only the SDK from the repository root:

```sh
npm run sdk:build
npm run sdk:test
```

The smoke test validates the embedded bridge and the loopback HTTP client. It binds a
temporary `127.0.0.1` port, so run it from a terminal with permission to open a local
listener.

Inspect the exact files that would be published:

```sh
npm pack --dry-run --workspace @kucedr/sdk
```

### Develop the CLI

Build and test only the CLI:

```sh
npm run cli:build
npm run cli:test
node packages/cli/dist/bin.js --help
```

Optionally link the development CLI globally:

```sh
npm link ./packages/cli
kucedr --version
kucedr --help
```

Remove the global link when finished:

```sh
npm unlink --global @kucedr/cli
```

Inspect the publishable CLI tarball:

```sh
npm pack --dry-run --workspace @kucedr/cli
```

### Run the example project

The example is not a root workspace. Install and run it from its own directory:

```sh
npm --prefix packages/examples/projects ci
npm --prefix packages/examples/projects run dev
```

## Test the repository

### Fast checks while coding

Run the checks closest to the code being changed:

```sh
npm run typecheck:app       # Electron main, preload, and renderer TypeScript
npm run typecheck:packages  # SDK and CLI TypeScript
npm run test:main           # Main-process and integration Jest projects
npm run test:renderer       # Renderer Jest project
npm run sdk:test            # SDK build and smoke test
npm run cli:test            # CLI test suite
```

Run one Jest test file by passing its path:

```sh
npm run test:main -- tests/unit/main/agent/session/session-model-messages.test.ts
npm run test:renderer -- tests/unit/renderer/rag-settings.test.tsx
```

### Full local quality gate

The intended comprehensive local gate is:

```sh
npm run quality:check
```

It runs, in order:

1. App, SDK, and CLI typechecks.
2. ESLint.
3. Main-process and integration Jest tests.
4. Renderer Jest tests.
5. SDK and CLI tests.

Also verify formatting without rewriting files:

```sh
npm run format:check
```

CI and release builds run this same gate. Run it locally before submitting changes.

### Production build

Build the Electron application:

```sh
npm run build
```

Build both publishable packages:

```sh
npm run build:packages
```

Build all three products:

```sh
npm run build:all
```

Successful Electron output is written to `out/`. SDK and CLI output is written below each
package's `dist/` directory.

Run the compiled Electron app without creating an installer:

```sh
npm run build
npx --no-install electron .
```

### Build installers locally

Build installers on the native target operating system:

| Operating system | Command                                         | Output                              |
| ---------------- | ----------------------------------------------- | ----------------------------------- |
| Windows          | `npm run dist:win`                              | x64 NSIS and portable `.exe`        |
| Windows          | `npm run dist:win:portable`                     | x64 portable `.exe` only            |
| macOS            | `npm run dist:mac`                              | x64/arm64 `.dmg` and `.pkg`         |
| macOS            | `npm run dist:mac:dmg`                          | x64/arm64 `.dmg` only               |
| Linux            | `npm run dist:linux:appimage`                   | x64 `.AppImage`                     |
| Linux            | `npm run dist:linux:portable`                   | x64 `.AppImage` and `.tar.gz`       |
| Linux            | `npm run build && npx electron-builder --linux` | x64 `.AppImage`, `.tar.gz`, and DEB |

Artifacts are written to the root `dist/` directory. Local packaging never uploads because
`electron-builder.json` sets `publish` to `null`.

Production Windows packaging requires the signing certificate configured through
`CSC_LINK` and `CSC_KEY_PASSWORD`. Production macOS packaging requires signing and
notarization credentials. The development/staging `dist:*:dev` and `dist:*:staging`
scripts currently reference missing helper scripts and must not be used until those
helpers are restored.

The Windows portable target is signed and runs as the current user. It extracts to a temporary
directory for the lifetime of the process, so enterprise policies that prohibit execution from
temporary or user-writable locations still require an IT exception. The Linux archive is the
fallback when AppImage mounting or FUSE is unavailable. Both formats keep application data in the
user profile and require manual replacement for upgrades.

### End-to-end tests

The Playwright suite launches the compiled Electron application, so build first:

```sh
npm run build
npm run test:e2e
```

The tests run serially because they share an Electron window. HTML reports are written to
`playwright-report/`; screenshots and other artifacts are written to `test-results/`.

### Coverage

Run Jest with coverage:

```sh
npm run test:coverage
```

The configured global thresholds are 50% for branches, functions, lines, and statements.
Reports are written to `coverage/`.

### Match the automated CI gate

The `CI` workflow runs for pull requests and every push to `main`:

```sh
npm ci
npm run typecheck
npm run build
npm run test:packages
npm run build:packages
npm pack --dry-run --workspace @kucedr/sdk
npm pack --dry-run --workspace @kucedr/cli
```

Newer pushes cancel an older in-progress CI run for the same branch. A cancelled run
therefore does not necessarily mean a test failed; inspect the newest run.

## Push a normal change

A normal branch push runs CI but does not deploy any product.

Create a branch:

```sh
git switch -c your-change
```

Before committing:

```sh
git status --short
git diff --check
npm run typecheck
npm run test:packages
npm run build
```

Stage only the intended files, commit, and push:

```sh
git add path/to/file
git commit -m "describe the change"
git push --set-upstream origin your-change
```

Open a pull request, wait for the latest CI run to pass, and merge it into `main`.

## Deployment

Deployment is tag-driven:

| Tag          | Workflow               | Result                                |
| ------------ | ---------------------- | ------------------------------------- |
| `v1.2.3`     | `Release Electron app` | Signed installers in a GitHub Release |
| `sdk-v1.2.3` | `Publish npm package`  | `@kucedr/sdk@1.2.3` on npm            |
| `cli-v1.2.3` | `Publish npm package`  | `@kucedr/cli@1.2.3` on npm            |

Versions are independent. Releasing the SDK does not release the CLI or Electron app.
A normal push to `main` runs CI only.

### One-time GitHub and npm setup

#### Electron signing

Configure these GitHub Actions secrets before creating an Electron release tag:

| Platform           | Required secret                                            |
| ------------------ | ---------------------------------------------------------- |
| macOS signing      | `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`                     |
| macOS notarization | `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` |
| Windows signing    | `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`                     |

`MAC_CSC_LINK` and `WIN_CSC_LINK` may contain a supported secure URL or the appropriate
base64-encoded certificate. The release workflow intentionally fails rather than publish
an unsigned production installer.

#### Initial npm publication

The npm packages must exist before trusted publishing can be configured. At the time of
the initial bootstrap, confirm that the `@kucedr` scope belongs to the intended npm account
or organization, then publish each package once from a protected maintainer machine:

```sh
npm ci
npm run test:packages
npm login
npm whoami
npm publish --workspace @kucedr/sdk --access public
npm publish --workspace @kucedr/cli --access public
```

After both packages exist:

1. Create a protected GitHub environment named `npm` and require a reviewer.
2. Open the trusted publisher settings for each npm package.
3. Select GitHub Actions.
4. Set owner `HaraldBregu`, repository `kucedr`, workflow `npm-publish.yml`, and
   environment `npm`. The values are case-sensitive.
5. Test the next package version with a tag-based release.
6. Revoke any bootstrap token and remove it from GitHub.

The workflow uses GitHub OpenID Connect with `id-token: write`; it does not need an
`NPM_TOKEN`.

### Release safety rules

- Always pass `--no-git-tag-version` to `npm version`. A bare `npm version` creates a
  generic `vX.Y.Z` tag that can trigger the Electron workflow accidentally.
- Push one explicit product tag. Never use `git push --tags`.
- Never move or reuse a release tag.
- Never publish all workspaces together. Use one explicit `--workspace` value.
- Wait for CI on the version commit before pushing its deployment tag.

### Release preflight for every product

Run this preflight before the Electron, SDK, or CLI instructions below:

```sh
git switch main
git pull --ff-only origin main
git status --short
```

Continue only when `git status --short` has no output. This ensures the version commit and
release tag are created from the current `main` branch rather than an unmerged feature
branch.

### Release the Electron app

The root manifest version and tag must match exactly.

1. Complete the shared [release preflight](#release-preflight-for-every-product).

2. Set the next version without creating npm's automatic tag:

   ```sh
   npm version 1.0.3 --no-git-tag-version
   ```

3. Review the version changes and run the release checks:

   ```sh
   git diff -- package.json package-lock.json
   npm ci
   npm run typecheck
   npm run build
   npm run test:packages
   npm run build:packages
   ```

4. Commit and push the release version:

   ```sh
   git add package.json package-lock.json
   git commit -m "release app v1.0.3"
   git push origin main
   ```

5. Wait for the latest `CI` run on that commit to succeed.

6. Create an annotated tag on the verified commit and push only that tag:

   ```sh
   git tag -a v1.0.3 -m "Kucedr v1.0.3"
   git push origin v1.0.3
   ```

The release workflow rejects a tag that does not equal `v` plus the root manifest
version. It builds on native macOS, Windows, and Linux runners. After every platform
succeeds, it creates one GitHub Release containing DMG, PKG, EXE, AppImage, and DEB
artifacts.

Verify:

1. The `Release Electron app` workflow is green.
2. The GitHub Release version and tag are correct.
3. Every expected platform artifact is attached.
4. macOS artifacts are signed and notarized.
5. The Windows installer has a valid signature.
6. Install and launch each artifact on its target operating system.

### Release the SDK

1. Complete the shared [release preflight](#release-preflight-for-every-product).

2. Update only the SDK version:

   ```sh
   npm version 0.1.1 --workspace @kucedr/sdk --no-git-tag-version
   ```

3. Verify the manifest, tests, build, and tarball:

   ```sh
   node -p "require('./packages/sdk/package.json').version"
   npm run typecheck --workspace @kucedr/sdk
   npm test --workspace @kucedr/sdk
   npm pack --dry-run --workspace @kucedr/sdk
   ```

4. Commit and push:

   ```sh
   git add packages/sdk/package.json package-lock.json
   git commit -m "release sdk v0.1.1"
   git push origin main
   ```

5. Wait for CI, then tag the same commit:

   ```sh
   git tag -a sdk-v0.1.1 -m "@kucedr/sdk v0.1.1"
   git push origin sdk-v0.1.1
   ```

6. Verify the published version and provenance:

   ```sh
   npm view @kucedr/sdk@0.1.1 version
   npm view @kucedr/sdk@0.1.1 dist
   ```

### Release the CLI

1. Complete the shared [release preflight](#release-preflight-for-every-product).

2. Update the CLI package version:

   ```sh
   npm version 0.1.1 --workspace @kucedr/cli --no-git-tag-version
   ```

   The CLI currently also declares its displayed version in
   `packages/cli/src/program.ts`. Update the `.version('...')` value to exactly `0.1.1`.

3. Verify the manifest, displayed version, tests, build, and tarball:

   ```sh
   node -p "require('./packages/cli/package.json').version"
   npm run typecheck --workspace @kucedr/cli
   npm test --workspace @kucedr/cli
   npm run build --workspace @kucedr/cli
   node packages/cli/dist/bin.js --version
   npm pack --dry-run --workspace @kucedr/cli
   ```

   The two version commands must both print `0.1.1`.

4. Commit and push:

   ```sh
   git add packages/cli/package.json packages/cli/src/program.ts package-lock.json
   git commit -m "release cli v0.1.1"
   git push origin main
   ```

5. Wait for CI, then tag the same commit:

   ```sh
   git tag -a cli-v0.1.1 -m "@kucedr/cli v0.1.1"
   git push origin cli-v0.1.1
   ```

6. Verify the published package:

   ```sh
   npm view @kucedr/cli@0.1.1 version
   npm install --global @kucedr/cli@0.1.1
   kucedr --version
   kucedr --help
   ```

### Manually dispatch an npm release

The `Publish npm package` workflow can also be started from GitHub Actions:

1. Open **Actions → Publish npm package → Run workflow**.
2. Select the branch or tag containing the exact package version.
3. Select `sdk` or `cli`.
4. Enter the exact semantic version from that package's `package.json`.
5. Approve the protected `npm` environment when prompted.

The workflow stops if the version differs from the selected manifest or already exists on
npm.

## Recovery and troubleshooting

### A tag does not match the manifest

Do not move or reuse the tag. Delete an unpushed local tag, correct the version, and create
the right tag:

```sh
git tag --delete incorrect-tag
```

If the tag was already pushed, increment the product version and create a new release tag.

### An npm version already exists

npm versions are immutable. Deprecate the bad version if necessary, fix the package,
increment its version, and publish a new tag:

```sh
npm deprecate @kucedr/sdk@0.1.1 "Use a newer version"
```

Use the equivalent package name for the CLI.

### Electron signing fails

Check that every required secret exists, certificate passwords are correct, certificates
have not expired, and Apple notarization credentials belong to the signing team. Rerun the
failed workflow only after fixing the secret or repository setting.

### `npm ci` reports a lockfile mismatch

The root manifest and lockfile were changed separately. From the intended dependency
state, regenerate and review the lockfile:

```sh
npm install --package-lock-only
git diff -- package-lock.json
```

Commit the manifest and lockfile together.

### Electron native dependencies are stale

Reinstall from the committed lockfile:

```sh
npm run clean
npm ci
```

### A release workflow partially fails

- Electron assets are published only after all platform builds succeed. Fix the failure
  and rerun the workflow for the same tag.
- npm cannot republish an existing version. If publication completed, increment the
  package version instead of rerunning it.
- Never overwrite an existing release tag with a different commit.
