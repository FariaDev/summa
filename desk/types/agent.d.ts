/* Mensagens e eventos que o adaptador do Claude entrega ao serviço (#43 fase 3).
   Só o que os arquivos verificados leem; o resto do evento segue `unknown`. */
export type AgentContentPart = {type: string, text?: string, [field: string]: unknown};
export type AgentMessage = {role: string, uuid?: string, content?: AgentContentPart[], [field: string]: unknown};
export type AgentInitEvent = {type: 'init', executable?: string, executableNote?: string, conversationId?: string, [field: string]: unknown};
/* O que o `AgentService` usa do adaptador do motor (ClaudeAdapter ou
   OpenCodeAdapter); os controles opcionais só existem num dos dois. */
export interface EngineAdapter {
  conversationId?: string;
  historyComplete?: boolean;
  send(input: Record<string, any>): Promise<any>;
  command?(input: Record<string, any>): Promise<any>;
  controlsSnapshot?(): Record<string, any>;
  initializeControls?(): Promise<any>;
  setControls?(selection: unknown, options?: Record<string, any>): Promise<any>;
  sessionUsage?(): Promise<any>;
  compact?(args?: unknown): Promise<any>;
  commands?(): Promise<any>;
  stageRevert?(messageId: string): Promise<any>;
  undoRevert?(): Promise<any>;
  [member: string]: any;
}
