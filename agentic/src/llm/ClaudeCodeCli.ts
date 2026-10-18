import { spawn } from 'node:child_process';
import type { LlmClient, LlmRequest, LlmResponse } from './LlmClient.ts';

export interface ClaudeCodeOptions {
  model?: string; // alias such as "sonnet" or "opus"
  timeoutMs?: number;
  bin?: string;
}

/**
 * Runs the model through the user's own Claude Code login (`claude -p`), so no API key is involved.
 *
 * - `--tools ""`: the model gets no Bash/Read; it only reasons over the evidence in the prompt.
 * - `--setting-sources ""` and `--no-session-persistence`: the user's hooks, CLAUDE.md and memory
 *   stay out of the classification and nothing is saved to session history.
 * - Not `--bare`: bare mode accepts only an API key.
 * - ANTHROPIC_API_KEY is removed from the child's environment so the CLI cannot fall back to it.
 */
export class ClaudeCodeCli implements LlmClient {
  private readonly opts: ClaudeCodeOptions;

  constructor(opts: ClaudeCodeOptions = {}) {
    this.opts = opts;
  }

  complete(req: LlmRequest): Promise<LlmResponse> {
    const args = [
      '-p',
      '--tools', '',
      '--output-format', 'json',
      '--json-schema', JSON.stringify(stripSchemaKey(req.jsonSchema)),
      '--system-prompt', req.system,
      '--no-session-persistence',
      '--setting-sources', '',
    ];
    if (this.opts.model) args.push('--model', this.opts.model);

    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;

    const started = Date.now();
    return new Promise((resolve, reject) => {
      const child = spawn(this.opts.bin ?? 'claude', args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`claude -p timed out after ${this.opts.timeoutMs ?? 180_000} ms`));
      }, this.opts.timeoutMs ?? 180_000);

      child.stdout.on('data', d => (stdout += d));
      child.stderr.on('data', d => (stderr += d));
      child.on('error', e => {
        clearTimeout(timer);
        reject(e);
      });
      child.on('close', code => {
        clearTimeout(timer);
        if (code !== 0) return reject(new Error(`claude -p exited ${code}: ${stderr || stdout}`.slice(0, 2000)));
        try {
          resolve(parseCliOutput(stdout, Date.now() - started));
        } catch (e) {
          reject(e);
        }
      });
      child.stdin.end(req.prompt);
    });
  }
}

/** Exported for unit tests. Accepts the `--output-format json` envelope. */
export function parseCliOutput(stdout: string, durationMs: number): LlmResponse {
  const envelope = JSON.parse(stdout);
  const env = Array.isArray(envelope) ? envelope.find(e => e.type === 'result') : envelope;
  if (!env) throw new Error('No result in claude output');
  if (env.is_error) throw new Error(`claude reported an error: ${String(env.result).slice(0, 500)}`);

  let output: unknown = env.structured_output;
  if (output === undefined && typeof env.result === 'string') {
    const text = env.result.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
    output = JSON.parse(text);
  }
  if (output === undefined) throw new Error('claude output had neither structured_output nor a JSON result');

  return { output, durationMs, costUsd: env.total_cost_usd, model: env.model };
}

/** The CLI's validator cannot resolve the draft-2020-12 `$schema` URI that zod emits. */
function stripSchemaKey(schema: object): object {
  const { $schema: _ignored, ...rest } = schema as Record<string, unknown>;
  return rest;
}
