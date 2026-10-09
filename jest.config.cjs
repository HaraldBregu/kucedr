/**
 * Jest configuration for Kucedr.
 *
 * Uses a multi-project setup:
 *   - "main"     : tests for the Electron main process (Node environment)
 *   - "renderer" : tests for the React renderer process (jsdom environment)
 *
 * ts-jest handles TypeScript compilation. Config is CJS to avoid needing
 * ts-node (the project uses "type": "module" in package.json).
 *
 * @type {import('jest').Config}
 */
module.exports = {
	projects: [
		// ---- Main process tests (Node env) ----
		{
			displayName: 'main',
			testEnvironment: 'node',
			roots: ['<rootDir>/tests/unit/main', '<rootDir>/tests/integration'],
			transform: {
				// Use the custom vite-env-transform for source files under src/main/
				// so that `import.meta.env.*` references (Vite-only syntax) are
				// rewritten to safe globalThis.__VITE_ENV__.* accesses before ts-jest
				// compiles them. Without this, ts-jest in CJS mode throws a SyntaxError.
				'^.+[\\\\/]src[\\\\/]main[\\\\/].+\\.tsx?$':
					'<rootDir>/tests/transforms/vite-env-transform.cjs',
				// All other TypeScript files (tests themselves, shared utilities) use
				// vanilla ts-jest.
				'^.+\\.tsx?$': [
					'ts-jest',
					{
						tsconfig: '<rootDir>/tsconfig.node.json',
						useESM: false,
					},
				],
			},
			moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
			moduleNameMapper: {
				'^@earendil-works/pi-coding-agent$': '<rootDir>/tests/mocks/pi-coding-agent.ts',
				'^node-pty$': '<rootDir>/tests/mocks/node-pty.ts',
				'^shell-env$': '<rootDir>/tests/mocks/shell-env.ts',
				'^electron$': '<rootDir>/tests/mocks/electron.ts',
				'^electron-store$': '<rootDir>/tests/mocks/electron-store.ts',
				// chokidar v5 is pure ESM; substitute a CJS-compatible mock so that
				// main-process tests can import source modules that depend on it without
				// hitting "Cannot use import statement outside a module".
				'^chokidar$': '<rootDir>/tests/mocks/chokidar.ts',
				'\\.md\\?raw$': '<rootDir>/tests/mocks/raw-md.ts',
				// Source files use ESM-style relative `.js` imports (required by Vite at
				// runtime). ts-jest in CJS mode can't resolve the .js suffix to the .ts
				// source, so strip it here.
				'^(\\.{1,2}/.*)\\.js$': '$1',
			},
			// Seed globalThis.__VITE_ENV__ before modules are loaded so that the
			// rewritten import.meta.env accesses resolve to defined (not undefined) objects.
			setupFiles: ['<rootDir>/tests/setup/main.ts'],
			testMatch: ['**/*.test.ts'],
		},

		// ---- Renderer process tests (jsdom env) ----
		{
			displayName: 'renderer',
			testEnvironment: 'jest-environment-jsdom',
			roots: ['<rootDir>/tests/unit/renderer'],
			transform: {
				// Apply the vite-env-transform to renderer source files that may contain
				// `import.meta.env.*` references (Vite-only syntax unsupported by ts-jest CJS).
				'^.+[\\\\/]src[\\\\/]renderer[\\\\/].+\\.tsx?$':
					'<rootDir>/tests/transforms/vite-env-transform.cjs',
				// All other TypeScript files (tests, shared utilities) use vanilla ts-jest.
				'^.+\\.tsx?$': [
					'ts-jest',
					{
						tsconfig: '<rootDir>/tsconfig.web.json',
						useESM: false,
					},
				],
			},
			moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
			moduleNameMapper: {
				'^react$': '<rootDir>/node_modules/react',
				'^react/(.*)$': '<rootDir>/node_modules/react/$1',
				'^react-dom$': '<rootDir>/node_modules/react-dom',
				'^react-dom/(.*)$': '<rootDir>/node_modules/react-dom/$1',
				// Path aliases (match tsconfig.web.json and electron.vite.config.ts)
				'^@/(.*)$': '<rootDir>/src/renderer/src/$1',
				'^@utils/(.*)$': '<rootDir>/src/renderer/src/utils/$1',
				'^@pages/(.*)$': '<rootDir>/src/renderer/src/pages/$1',
				'^@store/(.*)$': '<rootDir>/src/renderer/src/store/$1',
				'^@components/(.*)$': '<rootDir>/src/renderer/src/components/$1',
				'^@icons/(.*)$': '<rootDir>/src/renderer/src/components/icons/$1',
				'^@shared$': '<rootDir>/src/shared/index.ts',
				'^@shared/(.*)$': '<rootDir>/src/shared/$1',
				'^@resources/(.*)\.(png|jpg|jpeg|gif|svg|webp|ico|ogg)$': '<rootDir>/tests/mocks/fileMock.ts',
				'^@resources/(.*)$': '<rootDir>/resources/$1',
				// Handle bare src/renderer/src imports used in some UI components
				'^src/renderer/src/(.*)$': '<rootDir>/src/renderer/src/$1',
				// Static asset stubs
				'\\.(css|less|scss|sass)$': 'identity-obj-proxy',
				'\\.(png|jpg|jpeg|gif|svg|webp|ico|ogg)$': '<rootDir>/tests/mocks/fileMock.ts',
			},
			setupFiles: ['<rootDir>/tests/setup/polyfills.ts'],
			setupFilesAfterEnv: ['<rootDir>/tests/setup/renderer.ts'],
			testMatch: ['**/*.test.ts', '**/*.test.tsx'],
		},
	],

	// Automatically clear, reset, and restore mocks between tests
	clearMocks: true,
	resetMocks: true,
	restoreMocks: true,

	// Global coverage config
	collectCoverageFrom: [
		'src/**/*.{ts,tsx}',
		'!src/**/*.d.ts',
		'!src/**/index.ts',
		'!src/main/index.ts',
		'!src/renderer/src/main.tsx',
		'!src/env.d.ts',
		'!src/types.d.ts',
	],
	coverageDirectory: 'coverage',
	coverageReporters: ['text', 'text-summary', 'lcov', 'clover'],
	coverageThreshold: {
		global: {
			branches: 50,
			functions: 50,
			lines: 50,
			statements: 50,
		},
	},
};
