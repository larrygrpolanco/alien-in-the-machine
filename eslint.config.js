import prettier from 'eslint-config-prettier';
import { fileURLToPath } from 'node:url';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';
import css from 'eslint-plugin-css'; // For CSS-in-JS and style validation
import stylelint from 'eslint-plugin-stylelint'; // Integrate stylelint rules

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',
			'@typescript-eslint/no-unused-vars': 'error',
			'eqeqeq': 'error',
			'no-console': 'warn',
			// CSS validation rules for responsive design
			'css/no-invalid': 'error',
			'stylelint/order': 'warn',
			// Warn on hardcoded px for responsive elements
			'stylelint/selector-max-specificity': ['warn', '0,1,0'],
			'stylelint/media-feature-name-no-vendor-prefix': 'error',
			'stylelint/declaration-block-no-shorthand-property-overrides': 'error'
		},
		settings: {
			stylelint: {
				extends: ['stylelint-config-standard'],
				rules: {
					// Prefer responsive units over px
					'length-zero-no-unit': true,
					'number-max-precision': 2,
					'unit-no-unknown': true,
					// No vendor prefixes for modern browsers
					'media-feature-name-no-vendor-prefix': true,
					// Enforce consistent ordering
					'order/properties-alphabetical-order': true,
					// Warn on fixed widths/heights that could break responsive
					'declaration-property-value-disallowed-list': {
						'/width/': ['px', '!100%'],
						'/height/': ['px', '!50vh', '!auto']
					}
				}
			}
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js', '**/*.css'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte', '.css'],
				parser: ts.parser,
				svelteConfig
			}
		},
		plugins: {
			stylelint: stylelint,
			css: css
		},
		rules: {
			'stylelint/custom-rule': 'warn' // Placeholder for responsive CSS checks
		}
	}
);
