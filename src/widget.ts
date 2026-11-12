export interface ChatWidgetPersona {
  name: string;
  subtitle: string;
  greeting: string;
  avatarUrl: string;
}

export interface ChatWidgetLabels {
  placeholder: string;
  send: string;
  close: string;
  open: string;
  human: string;
  resolve: string;
  retrying: string;
  rateLimited: string;
  failed: string;
}

export interface ChatWidgetEndpoints {
  chat: string;
  resolve?: string;
  escalate?: string;
}

export interface ChatWidgetConfig {
  rootId?: string;
  persona: ChatWidgetPersona;
  endpoints: ChatWidgetEndpoints;
  csrf?: string;
  labels: ChatWidgetLabels;
  /** Same-origin URL of the shipped browser script. */
  scriptSrc: string;
  /** Same-origin URL of the shipped stylesheet. */
  styleHref: string;
}

export interface ChatWidgetModel {
  rootId: string;
  configJson: string;
  persona: ChatWidgetPersona;
  labels: ChatWidgetLabels;
  scriptSrc: string;
  styleHref: string;
  endpoints: ChatWidgetEndpoints;
  csrf?: string;
}

/**
 * JSON for a script-data element. Escapes the characters that would close the
 * element or break a line inside a script.
 */
export function safeJsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Values the browser script reads. Persona text stays in the host markup. */
export function chatWidgetModel(config: ChatWidgetConfig): ChatWidgetModel {
  const rootId = config.rootId ?? "chat-widget";
  const island = {
    rootId,
    endpoints: config.endpoints,
    csrf: config.csrf ?? "",
    labels: {
      retrying: config.labels.retrying,
      rateLimited: config.labels.rateLimited,
      failed: config.labels.failed,
      human: config.labels.human,
    },
  };
  return {
    rootId,
    configJson: safeJsonForScript(island),
    persona: config.persona,
    labels: config.labels,
    scriptSrc: config.scriptSrc,
    styleHref: config.styleHref,
    endpoints: config.endpoints,
    csrf: config.csrf,
  };
}
