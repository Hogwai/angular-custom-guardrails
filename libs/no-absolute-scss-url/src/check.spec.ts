import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { checkScssFile, expandInputs } from './check';

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures');

describe('checkScssFile', () => {
  it('returns no diagnostics for relative URLs', async () => {
    const filePath = path.join(FIXTURES_DIR, 'valid', 'relative.scss');
    const diagnostics = await checkScssFile(filePath);
    expect(diagnostics).toEqual([]);
  });

  it('returns no diagnostics for fragment, https, and data URLs', async () => {
    const filePath = path.join(
      FIXTURES_DIR,
      'valid',
      'schemes-and-fragments.scss',
    );
    const diagnostics = await checkScssFile(filePath);
    expect(diagnostics).toEqual([]);
  });

  it('returns diagnostics for absolute URLs', async () => {
    const filePath = path.join(FIXTURES_DIR, 'invalid', 'absolute.scss');
    const diagnostics = await checkScssFile(filePath);
    expect(diagnostics.length).toBe(2);
    expect(diagnostics[0]).toEqual({
      filePath: expect.stringContaining('absolute.scss'),
      line: 1,
      value: '/assets/logo.svg',
    });
    expect(diagnostics[1]).toEqual({
      filePath: expect.stringContaining('absolute.scss'),
      line: 2,
      value: '/images/hero.jpg',
    });
  });

  it('returns no diagnostics for valid edge cases (empty, data, fragment, relative with spaces)', async () => {
    const filePath = path.join(FIXTURES_DIR, 'valid', 'edge-cases.scss');
    const diagnostics = await checkScssFile(filePath);
    expect(diagnostics).toEqual([]);
  });

  it('handles spaces inside url()', async () => {
    const filePath = path.join(FIXTURES_DIR, 'invalid', 'edge-cases.scss');
    const diagnostics = await checkScssFile(filePath);
    const spacesDiag = diagnostics.find((d) => d.value === '/assets/spaces.svg');
    expect(spacesDiag).toBeDefined();
    expect(spacesDiag?.line).toBe(1);
  });

  it('handles unquoted absolute URLs', async () => {
    const filePath = path.join(FIXTURES_DIR, 'invalid', 'edge-cases.scss');
    const diagnostics = await checkScssFile(filePath);
    const unquotedDiag = diagnostics.find(
      (d) => d.value === '/assets/unquoted.svg',
    );
    expect(unquotedDiag).toBeDefined();
    expect(unquotedDiag?.line).toBe(2);
  });

  it('calculates correct line for multiline url()', async () => {
    const filePath = path.join(FIXTURES_DIR, 'invalid', 'edge-cases.scss');
    const diagnostics = await checkScssFile(filePath);
    const multilineDiag = diagnostics.find(
      (d) => d.value === '/assets/multiline.svg',
    );
    expect(multilineDiag).toBeDefined();
    expect(multilineDiag?.line).toBe(5);
  });

  it('returns all diagnostics across multiple files', async () => {
    const files = [
      path.join(FIXTURES_DIR, 'invalid', 'absolute.scss'),
      path.join(FIXTURES_DIR, 'invalid', 'edge-cases.scss'),
    ];
    const allResults = await Promise.all(files.map(checkScssFile));
    const allDiagnostics = allResults.flat();
    // absolute.scss: 2 + edge-cases.scss: 4 = 6
    expect(allDiagnostics.length).toBe(6);
  });

  it('detects absolute URLs in @import, @use and case-insensitive URL()', async () => {
    const filePath = path.join(FIXTURES_DIR, 'invalid', 'at-rules.scss');
    const diagnostics = await checkScssFile(filePath);
    expect(diagnostics).toEqual([
      {
        filePath: expect.stringContaining('at-rules.scss'),
        line: 1,
        value: '/assets/theme.css',
      },
      {
        filePath: expect.stringContaining('at-rules.scss'),
        line: 2,
        value: '/assets/tokens',
      },
      {
        filePath: expect.stringContaining('at-rules.scss'),
        line: 4,
        value: '/assets/hero.jpg',
      },
    ]);
  });

  it('accepts protocol-relative and uppercase-scheme external URLs', async () => {
    const filePath = path.join(FIXTURES_DIR, 'valid', 'external-urls.scss');
    const diagnostics = await checkScssFile(filePath);
    expect(diagnostics).toEqual([]);
  });

  it('accepts relative @forward at-rules', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nasu-forward-'));
    try {
      const filePath = path.join(dir, 'partial.scss');
      fs.writeFileSync(filePath, "@forward './theme';\n");
      const diagnostics = await checkScssFile(filePath);
      expect(diagnostics).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('flags absolute @forward at-rules', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nasu-forward-'));
    try {
      const filePath = path.join(dir, 'partial.scss');
      fs.writeFileSync(filePath, "@forward '/shared/tokens' as prefix-*;\n");
      const diagnostics = await checkScssFile(filePath);
      expect(diagnostics).toEqual([
        { filePath, line: 1, value: '/shared/tokens' },
      ]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  describe('expandInputs', () => {
    it('expands directories recursively and keeps only .scss files', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nasu-expand-'));
      try {
        const nested = path.join(dir, 'a', 'b');
        fs.mkdirSync(nested, { recursive: true });
        fs.writeFileSync(path.join(dir, 'top.scss'), '.a {}\n');
        fs.writeFileSync(path.join(nested, 'nested.scss'), '.b {}\n');
        fs.writeFileSync(path.join(dir, 'ignored.txt'), 'not scss\n');

        const files = expandInputs([dir]);
        expect(files).toEqual(
          expect.arrayContaining([
            path.join(dir, 'top.scss'),
            path.join(nested, 'nested.scss'),
          ]),
        );
        expect(files.some((f) => f.endsWith('.txt'))).toBe(false);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('deduplicates repeated inputs', () => {
      const filePath = path.join(FIXTURES_DIR, 'valid', 'relative.scss');
      const files = expandInputs([filePath, filePath]);
      expect(files).toEqual([path.resolve(filePath)]);
    });

    it('keeps a single file input unchanged', () => {
      const filePath = path.join(FIXTURES_DIR, 'valid', 'relative.scss');
      expect(expandInputs([filePath])).toEqual([path.resolve(filePath)]);
    });

    it('keeps non-existent inputs so the CLI can report a read error', () => {
      const missing = path.join(FIXTURES_DIR, 'does-not-exist.scss');
      expect(expandInputs([missing])).toEqual([path.resolve(missing)]);
    });
  });
});
