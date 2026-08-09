import * as path from 'path';
import { ESLint } from 'eslint';

const CONFIG_PATH = path.resolve(__dirname, '..', 'eslint.config.ts');
/**
 * lintText is given real project file paths so the type-aware rules can be
 * resolved through parserOptions.projectService; the content itself is virtual.
 */
const APP_TS_PATH = path.resolve(__dirname, '..', 'src', 'app', 'app.ts');
const APP_HTML_PATH = path.resolve(__dirname, '..', 'src', 'app', 'app.html');

const NESTED_SUBSCRIBE_CODE = [
  'import { of } from "rxjs";',
  'of(1).subscribe(() => of(2).subscribe(() => {}));',
  '',
].join('\n');

const TRACK_INDEX_TEMPLATE = [
  '@for (user of users; track $index) {',
  '  <p>{{ user.name }}</p>',
  '}',
  '',
].join('\n');

describe('playground ESLint integration', () => {
  it(
    'loads the playground config without errors',
    async () => {
      const eslint = new ESLint({
        overrideConfigFile: CONFIG_PATH,
      });
      /**
       * Verify the config loads: lintText uses an existing project file
       * exercises config loading and the TypeScript project service.
       */
      const results = await eslint.lintText('// empty\n', { filePath: APP_TS_PATH });
      expect(results).toBeDefined();
      expect(results).toHaveLength(1);
      expect(results[0].messages).toEqual([]);
    },
    180000,
  );

  it('configures the custom-guardrails plugin with all three rules', async () => {
    const eslint = new ESLint({
      overrideConfigFile: CONFIG_PATH,
    });
    const config = await eslint.calculateConfigForFile('test.ts');
    // The plugin should be registered
    expect(config.plugins).toHaveProperty('custom-guardrails');
    // The rules should be configured
    expect(config.rules).toHaveProperty('custom-guardrails/max-pipe-depth');
    expect(config.rules).toHaveProperty('custom-guardrails/no-nested-subscribe');
  });

  it('configures the template rules for HTML files', async () => {
    const eslint = new ESLint({
      overrideConfigFile: CONFIG_PATH,
    });
    const config = await eslint.calculateConfigForFile('test.html');
    expect(config.rules).toHaveProperty('custom-guardrails/no-index-track');
  });

  it(
    'reports a nested subscribe through the playground configuration',
    async () => {
      const eslint = new ESLint({
        overrideConfigFile: CONFIG_PATH,
      });
      const [result] = await eslint.lintText(NESTED_SUBSCRIBE_CODE, {
        filePath: APP_TS_PATH,
      });

      expect(result.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ruleId: 'custom-guardrails/no-nested-subscribe',
          }),
        ]),
      );
    },
    180000,
  );

  it(
    'reports track $index in HTML templates through the playground configuration',
    async () => {
      const eslint = new ESLint({
        overrideConfigFile: CONFIG_PATH,
      });
      const [result] = await eslint.lintText(TRACK_INDEX_TEMPLATE, {
        filePath: APP_HTML_PATH,
      });

      expect(result.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ruleId: 'custom-guardrails/no-index-track',
          }),
        ]),
      );
    },
    180000,
  );
});
