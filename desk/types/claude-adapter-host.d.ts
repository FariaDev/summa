/* O que os mixins tipados do ClaudeAdapter (#58: steer, comandos e
   compactação, medidor) usam do adaptador montado. O `claude-adapter.cjs`
   não é verificado pelo tsc; esta é a fatia do contrato interno que os
   mixins novos leem, com o tipo que cada campo tem de fato. */

export interface ClaudeAdapterTurnState {
  id: string;
  wireUuid: string;
  generation: number;
  phase: string | null;
  finalized: boolean;
  degraded: boolean;
  steerUuids: Set<string>;
  item?: object;
  taken?: boolean;
  acceptResolved?: boolean;
  foreignSeen?: boolean;
  foreignWarned?: boolean;
  apiRetries?: Set<string>;
  acceptAttempted?: boolean;
  announcedRateLimits?: Set<string>;
  rejectedRateLimitTypes?: Set<string>;
  lastRateLimit?: object | null;
  latestAssistantRateLimited?: boolean;
  authenticationFailure?: boolean;
}

export interface ClaudeQueryLike {
  supportedCommands?: () => Promise<unknown>;
  setModel?: (model?: string) => Promise<unknown>;
  applyFlagSettings?: (settings: object) => Promise<unknown>;
}

export interface ClaudeAdapterHost {
  _connected: boolean;
  _closed: boolean;
  _busy: boolean;
  _turn: ClaudeAdapterTurnState | null;
  _query: ClaudeQueryLike | null;
  _queue: { push(item: object): void } | null;
  _queryDead: boolean;
  _sessionId: string | null;
  _timeoutMs: number;
  _controlsTimeoutMs: number;
  _compactTimeoutMs: number;
  _deliveryUncertain: boolean;
  _persistDelivery: ((state: { id: string; status: string }) => unknown) | null;
  _steers: Map<string, import('../src/agents/claude-adapter-steer.cjs').SteerDelivery>;
  _compaction: import('../src/agents/claude-compaction.cjs').CompactRequest | null;
  _compactUuid: string | null;
  _commandCache: import('../src/agents/claude-adapter-commands.cjs').ClaudeCommand[] | null;
  _usageSample: { usage: object; model: string | null } | null;
  _modelUsage: object | null;
  _emit(type: string, payload?: object): void;
  _emitTurn(turn: ClaudeAdapterTurnState, type: string, payload?: object): void;
  _bounded<T>(promise: Promise<T> | T, ms: number, code: string): Promise<T>;
  _ensureQuery(): Promise<ClaudeQueryLike>;
  _resetUsageSample(): void;
  connect(): Promise<unknown>;
  send(input: { id?: string; text: string; images: unknown[]; delivery?: 'steer' }): Promise<{ accepted: true; id: string }>;
}

/* O `this` dos mixins antigos (query, stream, controles, limite de uso, turnos,
   portão): o contrato tipado acima, os métodos do EventEmitter e os campos
   internos `_*` do adaptador montado ainda sem tipo próprio (#43 fase 3). */
export type ClaudeAdapterMixinSelf = ClaudeAdapterHost
  & Pick<import('node:events').EventEmitter, 'emit' | 'on' | 'off' | 'once'>
  & {[member: `_${string}`]: any};
