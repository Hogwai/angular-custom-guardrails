import * as fs from 'fs';
import * as path from 'path';
import postcss from 'postcss';
import * as postcssScss from 'postcss-scss';
import valueParser from 'postcss-value-parser';

export type Diagnostic = {
  filePath: string;
  line: number;
  value: string;
};

/**
 * Analyze a CSS value for absolute url() references and report them.
 * The function name comparison is case-insensitive (URL(), Url(), ...).
 */
function analyzeUrlValue(
  value: string,
  filePath: string,
  baseLine: number,
  diagnostics: Diagnostic[],
): void {
  const parsed = valueParser(value);
  parsed.walk((node) => {
    if (node.type !== 'function' || node.value.toLowerCase() !== 'url') {
      return;
    }

    // Find the first meaningful child (string or word), skipping whitespace nodes
    const urlNode = node.nodes.find(
      (n) => n.type === 'string' || n.type === 'word',
    );
    if (!urlNode) {
      return;
    }

    const urlValue = urlNode.value;
    if (!isAbsolutePath(urlValue)) {
      return;
    }

    // Calculate the line of the URL within the value
    const urlOffset = urlNode.sourceIndex;
    const valueBeforeUrl = value.substring(0, urlOffset);
    const newlinesBefore = (valueBeforeUrl.match(/\n/g) ?? []).length;
    const line = baseLine + newlinesBefore;

    diagnostics.push({
      filePath,
      line,
      value: urlValue,
    });
  });
}

/**
 * Analyze the params of a loading at-rule (import/use/forward).
 * A url(...) reference is delegated to analyzeUrlValue; a plain quoted
 * string is flagged when it is an absolute path.
 */
function analyzeAtRuleParams(
  params: string,
  filePath: string,
  baseLine: number,
  diagnostics: Diagnostic[],
): void {
  if (/url\(/i.test(params)) {
    analyzeUrlValue(params, filePath, baseLine, diagnostics);
    return;
  }

  const quotedString = /(['"])((?:\\.|(?!\1)[\s\S])*)\1/g;
  let match: RegExpExecArray | null;
  while ((match = quotedString.exec(params)) !== null) {
    const urlValue = match[2];
    if (!isAbsolutePath(urlValue)) {
      continue;
    }
    const valueBefore = params.substring(0, match.index);
    const newlinesBefore = (valueBefore.match(/\n/g) ?? []).length;
    diagnostics.push({
      filePath,
      line: baseLine + newlinesBefore,
      value: urlValue,
    });
  }
}

/**
 * Return true for absolute paths starting with `/`, while ignoring
 * data: URIs, http(s): URLs (any case), protocol-relative URLs (//)
 * and fragments (#).
 */
function isAbsolutePath(urlValue: string): boolean {
  const lowered = urlValue.toLowerCase();
  return (
    !!urlValue &&
    urlValue.startsWith('/') &&
    !urlValue.startsWith('//') &&
    !urlValue.startsWith('#') &&
    !lowered.startsWith('data:') &&
    !lowered.startsWith('http:') &&
    !lowered.startsWith('https:')
  );
}

export async function checkScssFile(
  filePath: string,
): Promise<Diagnostic[]> {
  const source = fs.readFileSync(filePath, 'utf-8');
  const root = postcss.parse(source, { syntax: postcssScss } as postcss.ProcessOptions);
  const diagnostics: Diagnostic[] = [];

  root.walkDecls((decl) => {
    const declLine = decl.source?.start?.line ?? 1;
    analyzeUrlValue(decl.value, filePath, declLine, diagnostics);
  });

  root.walkAtRules((atRule) => {
    const name = atRule.name.toLowerCase();
    if (name !== 'import' && name !== 'use' && name !== 'forward') {
      return;
    }
    const atLine = atRule.source?.start?.line ?? 1;
    analyzeAtRuleParams(atRule.params, filePath, atLine, diagnostics);
  });

  diagnostics.sort((a, b) => a.line - b.line);

  return diagnostics;
}

/**
 * Expand CLI inputs: directories are walked recursively and only `.scss`
 * files are kept. Duplicate paths are removed. Non-existent inputs are
 * preserved so the CLI can report a read error (exit code 1).
 */
export function expandInputs(inputs: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  const visit = (input: string): void => {
    const resolved = path.resolve(input);
    if (seen.has(resolved)) {
      return;
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(resolved);
    } catch {
      seen.add(resolved);
      result.push(resolved);
      return;
    }

    if (stat.isDirectory()) {
      const entries = fs.readdirSync(resolved, { withFileTypes: true });
      for (const entry of entries) {
        visit(path.join(resolved, entry.name));
      }
      return;
    }

    if (stat.isFile() && resolved.endsWith('.scss')) {
      seen.add(resolved);
      result.push(resolved);
    }
  };

  for (const input of inputs) {
    visit(input);
  }

  return result;
}

/**
 * CLI entry point. Returns 0 when every input is valid, 1 otherwise
 * (violation found, read error, or missing arguments).
 */
export async function runCli(args: string[]): Promise<number> {
  if (args.length === 0) {
    console.error(
      'Usage: no-absolute-scss-url <file-or-dir.scss> [file-or-dir.scss ...]',
    );
    return 1;
  }

  const files = expandInputs(args);
  const results = await Promise.allSettled(files.map(checkScssFile));

  let failed = false;
  for (const result of results) {
    if (result.status === 'rejected') {
      failed = true;
      console.error(result.reason);
      continue;
    }
    for (const d of result.value) {
      failed = true;
      console.error(`${d.filePath}:${d.line}: absolute URL '${d.value}'`);
    }
  }

  return failed ? 1 : 0;
}

if (require.main === module) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
