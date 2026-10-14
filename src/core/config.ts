import type {NetworkConfig} from './types.js';

const URL_TEXT = /[a-z][a-z\d+.-]*:\/\/[^\s"'<>]+/gi;

export function normalizeEndpoint(endpoint: string): URL {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error('Invalid endpoint');
  }
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) ||
      url.username || url.password || url.search || url.hash) {
    throw new Error('Invalid endpoint protocol or credentials/query/fragment');
  }
  return url;
}

// Only the configured endpoint and its URL-normalized equivalents are redacted.
// This does not discover arbitrary secrets or classify unrelated public URLs.
export function endpointRedactor(endpoint: string | null): (text: string) => string {
  if (endpoint === null) return text => text;
  const canonical = normalizeEndpoint(endpoint).href;
  return text => {
    if (!text.includes('://')) return text;
    const equivalentUrls = text.replace(URL_TEXT, candidate => {
      try {
        if (new URL(candidate).href === canonical) return '[endpoint]';
        // Prose punctuation can follow a URL without being part of the endpoint.
        const bare = candidate.replace(/[.,;:!?)\]}]+$/, '');
        if (new URL(bare).href === canonical) return '[endpoint]' + candidate.slice(bare.length);
      } catch { /* Non-URL text is retained as evidence. */ }
      return candidate;
    });
    return equivalentUrls.split(endpoint).join('[endpoint]').split(canonical).join('[endpoint]');
  };
}

export function validateNetworkConfig(value: unknown): NetworkConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid network config');
  }
  const config = value as Record<string, unknown>;
  const keys = ['id', 'name', 'source', 'endpoint', 'endpointAlias', 'kind', 'expectedGenesis'];
  if (Object.keys(config).length !== keys.length || keys.some(key => !Object.hasOwn(config, key))) {
    throw new Error('Invalid network config fields');
  }
  for (const [key, max] of [['id', 128], ['name', 256], ['source', 512], ['endpointAlias', 128]] as const) {
    if (typeof config[key] !== 'string' || !config[key].length || config[key].length > max) {
      throw new Error('Invalid config ' + key);
    }
  }
  for (const key of ['id', 'endpointAlias']) {
    if (/[a-z][a-z\d+.-]*:\/\//i.test(config[key] as string)) {
      throw new Error('Invalid config public identifier: ' + key + ' must be a label without a URL');
    }
  }
  if (!['event-testnet', 'mainnet-readonly', 'custom-readonly'].includes(config.kind as string)) {
    throw new Error('Invalid config kind');
  }
  if (config.expectedGenesis !== null &&
      (typeof config.expectedGenesis !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(config.expectedGenesis))) {
    throw new Error('Invalid expectedGenesis');
  }
  if (config.endpoint !== null &&
      (typeof config.endpoint !== 'string' || !config.endpoint.length || config.endpoint.length > 2048)) {
    throw new Error('Invalid endpoint');
  }
  const redact = endpointRedactor(config.endpoint as string | null);
  for (const key of keys.filter(key => key !== 'endpoint')) {
    const text = config[key];
    if (typeof text === 'string' && redact(text) !== text) {
      throw new Error('Invalid config: configured endpoint must not appear in public labels');
    }
  }
  return {
    ...config,
    expectedGenesis: typeof config.expectedGenesis === 'string' ? config.expectedGenesis.toLowerCase() : null,
  } as unknown as NetworkConfig;
}
