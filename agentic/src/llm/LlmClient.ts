export interface LlmRequest {
  system: string;
  prompt: string;
  /** JSON Schema the reply must satisfy. */
  jsonSchema: object;
}

export interface LlmResponse {
  /** Parsed structured output, not yet validated by our own schema. */
  output: unknown;
  durationMs: number;
  costUsd?: number;
  model?: string;
}

export interface LlmClient {
  complete(req: LlmRequest): Promise<LlmResponse>;
}
