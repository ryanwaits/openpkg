/**
 * Create a new client
 * @param url - API endpoint URL
 * @param apiKey - Your API key
 */
export function createClient(url: string, apiKey: string) {
  return { url, apiKey };
}

/**
 * Fetch data from the API
 * @param client - The client instance
 * @param endpoint - API endpoint path
 * @param options - Fetch options (NEW in v2)
 */
export function fetchData(
  client: { url: string; apiKey: string },
  endpoint: string,
  options?: { timeout?: number }  // NEW param in v2
) {
  return { data: [] };
}

/**
 * NEW in v2: Create a webhook
 */
export function createWebhook(url: string, events: string[]) {
  return { id: '123', url, events };
}

// REMOVED in v2: legacyFetch was here

