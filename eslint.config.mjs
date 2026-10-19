import tseslint from '@electron-toolkit/eslint-config-ts';
import eslintPluginReact from 'eslint-plugin-react';
import eslintPluginReactHooks from 'eslint-plugin-react-hooks';
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
	{
		ignores: [
			'**/node_modules',
			'**/dist',
			'**/.test-dist',
			'**/out',
			'**/scripts/*.cjs',
			'**/*.cjs',
			'project/**',
			'resources/plugins/**',
		],
	},
	tseslint.configs.recommended,
	eslintPluginReact.configs.flat.recommended,
	eslintPluginReact.configs.flat['jsx-runtime'],
	{
		settings: {
			react: {
				version: 'detect',
			},
		},
	},
	{
		files: ['**/*.{ts,tsx}'],
		plugins: {
			'react-hooks': eslintPluginReactHooks,
			'react-refresh': eslintPluginReactRefresh,
		},
		rules: {
			...eslintPluginReactHooks.configs.recommended.rules,
			...eslintPluginReactRefresh.configs.vite.rules,
			'react/prop-types': 'off',
			'react-hooks/set-state-in-effect': 'off',
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
			],
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unsafe-function-type': 'warn',
			'@typescript-eslint/no-require-imports': 'warn',
			'react-refresh/only-export-components': 'warn',
		},
	}
);
