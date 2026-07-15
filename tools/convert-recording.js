#!/usr/bin/env node
/**
 * Converts a raw Appium recording pasted from the UI Inspector's "Generated Test Script"
 * panel (a standalone WebdriverIO/Mocha script) into a screen/step class that extends
 * BaseScreen, ready to drop into screens/ and drive from a Playwright spec via the
 * appium.fixture driver.
 *
 * Usage:
 *   node tools/convert-recording.js --name SignOut --in recordings/sign-out.raw.ts --out screens/sign-out.screen.ts
 *   node tools/convert-recording.js --name SignOut < recordings/sign-out.raw.ts > screens/sign-out.screen.ts
 */
const fs = require('fs');

function parseArgs(argv) {
  const args = { name: null, in: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--name') args.name = argv[++i];
    else if (argv[i] === '--in') args.in = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
  }
  return args;
}

function readInput(args) {
  if (args.in) return fs.readFileSync(args.in, 'utf8');
  return fs.readFileSync(0, 'utf8'); // stdin
}

function toMethodName(stepNum, rawDescription) {
  let base = rawDescription.replace(/^Tap:\s*/i, '');
  if (/^Tap at\s*\(/i.test(base)) base = 'tap at coordinate';
  base = base.replace(/\[.*?\]/g, ''); // strip class-name hints like [android.view.View]
  const words = base
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const camel = words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join('');
  return `step${stepNum}_${camel || 'action'}`;
}

function convertCodeLine(codeLine) {
  let m;

  m = codeLine.match(/^await driver\.\$\((['"`])(.*?)\1\)\.click\(\);$/);
  if (m) return { call: `await this.tap(${JSON.stringify(m[2])});`, converted: true };

  m = codeLine.match(/^await driver\.\$\((['"`])(.*?)\1\)\.setValue\((['"`])(.*?)\3\);$/);
  if (m) return { call: `await this.type(${JSON.stringify(m[2])}, ${JSON.stringify(m[4])});`, converted: true };

  m = codeLine.match(/^await driver\.touchAction\(\{\s*action:\s*["']tap["'],\s*x:\s*(\d+),\s*y:\s*(\d+)\s*\}\);$/);
  if (m) return { call: `await this.tapAt(${m[1]}, ${m[2]});`, converted: true };

  // Unrecognized shape — keep it runnable by rebinding `driver` to `this.driver`, flagged for review.
  return { call: codeLine.replace(/\bdriver\b/g, 'this.driver'), converted: false };
}

function convert(raw, className) {
  const stepPattern = /\/\/ Step (\d+): ([^\n]+)\n\s*(await driver\.[^\n]+;)/g;
  const methods = [];
  let match;
  let unconvertedCount = 0;

  while ((match = stepPattern.exec(raw)) !== null) {
    const [, stepNum, description, codeLine] = match;
    const methodName = toMethodName(stepNum, description.trim());
    const { call, converted } = convertCodeLine(codeLine.trim());
    if (!converted) unconvertedCount++;

    methods.push(
      `  /** Step ${stepNum}: ${description.trim()} */\n` +
        `  async ${methodName}(): Promise<void> {\n` +
        (converted ? '' : '    // TODO: review — recorder emitted an unrecognized call shape\n') +
        `    ${call}\n` +
        `  }`
    );
  }

  if (methods.length === 0) {
    throw new Error('No "// Step N: ..." blocks found — is this a raw Inspector recording?');
  }

  const body =
    `import { BaseScreen } from './base.screen';\n\n` +
    `export class ${className} extends BaseScreen {\n` +
    methods.join('\n\n') +
    `\n}\n`;

  return { body, stepCount: methods.length, unconvertedCount };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.name) {
    console.error('Usage: node tools/convert-recording.js --name <ClassName> [--in <file>] [--out <file>]');
    process.exit(1);
  }

  const raw = readInput(args);
  const { body, stepCount, unconvertedCount } = convert(raw, args.name);

  if (args.out) {
    fs.writeFileSync(args.out, body);
    console.error(`Wrote ${args.out} (${stepCount} steps, ${unconvertedCount} flagged for manual review)`);
  } else {
    process.stdout.write(body);
  }
}

main();
