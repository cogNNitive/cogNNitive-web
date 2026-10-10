/**
 * nn-video-script/scripts/lib/cli-args.mjs
 *
 * Small strict argv parser: `--flag value`, `--flag=value`, booleans that never
 * swallow a following positional, repeatable flags, and loud errors for a missing
 * value or an unknown option. Zero external dependencies. ESM module.
 */

export class CliUsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CliUsageError';
  }
}

/**
 * @param {string[]} argv
 * @param {{ boolean?: string[], value?: string[], repeatable?: string[] }} spec
 *   `repeatable` flags take a value and may be given several times (collected in an array).
 * @returns {{ _: string[], flags: Record<string, any> }}
 */
export function parseArgs(argv, spec = {}) {
  const booleans = new Set(spec.boolean || []);
  const values = new Set(spec.value || []);
  const repeatables = new Set(spec.repeatable || []);
  const out = { _: [], flags: {} };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      out._.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    const inline = eq === -1 ? undefined : arg.slice(eq + 1);

    if (booleans.has(key)) {
      if (inline !== undefined) throw new CliUsageError('Option --' + key + ' does not take a value');
      out.flags[key] = true;
    } else if (values.has(key) || repeatables.has(key)) {
      let val = inline;
      if (val === undefined) {
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('--')) throw new CliUsageError('Option --' + key + ' requires a value');
        val = next;
        i++;
      }
      if (val === '') throw new CliUsageError('Option --' + key + ' requires a value');
      if (repeatables.has(key)) (out.flags[key] ||= []).push(val);
      else out.flags[key] = val;
    } else {
      throw new CliUsageError('Unknown option --' + key);
    }
  }
  return out;
}
