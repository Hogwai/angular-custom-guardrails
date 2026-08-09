import * as path from 'path';
import { runCli } from './check';

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures');

describe('runCli', () => {
  it('returns 0 for a valid file', async () => {
    const code = await runCli([
      path.join(FIXTURES_DIR, 'valid', 'relative.scss'),
    ]);
    expect(code).toBe(0);
  });

  it('returns 0 for a valid directory', async () => {
    const code = await runCli([path.join(FIXTURES_DIR, 'valid')]);
    expect(code).toBe(0);
  });

  it('returns 1 for an invalid file', async () => {
    const code = await runCli([
      path.join(FIXTURES_DIR, 'invalid', 'absolute.scss'),
    ]);
    expect(code).toBe(1);
  });

  it('returns 1 for an invalid directory', async () => {
    const code = await runCli([path.join(FIXTURES_DIR, 'invalid')]);
    expect(code).toBe(1);
  });

  it('returns 1 when at least one of several files is invalid', async () => {
    const code = await runCli([
      path.join(FIXTURES_DIR, 'valid', 'relative.scss'),
      path.join(FIXTURES_DIR, 'invalid', 'absolute.scss'),
    ]);
    expect(code).toBe(1);
  });

  it('returns 0 when several files are all valid', async () => {
    const code = await runCli([
      path.join(FIXTURES_DIR, 'valid', 'relative.scss'),
      path.join(FIXTURES_DIR, 'valid', 'external-urls.scss'),
    ]);
    expect(code).toBe(0);
  });

  it('returns 1 for a non-existent path', async () => {
    const code = await runCli([
      path.join(FIXTURES_DIR, 'does-not-exist.scss'),
    ]);
    expect(code).toBe(1);
  });

  it('returns 1 with usage when no arguments are provided', async () => {
    const code = await runCli([]);
    expect(code).toBe(1);
  });
});
