/**
 * Broker Utility Functions
 * 
 * Functions for normalizing broker names and generating prefixes for autocomplete
 */

/**
 * Normalize a string for searching
 * - Uppercase
 * - Remove punctuation
 * - Collapse spaces
 */
export function normalize(text: string): string {
  if (!text) return '';
  return text
    .toUpperCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with space
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
}

/**
 * Generate prefixes for a normalized string
 * Returns array of all prefixes (1 to min(10, length)) for each token + full string
 */
export function generatePrefixes(normalizedText: string): string[] {
  const prefixes = new Set<string>();
  
  // Split into tokens
  const tokens = normalizedText.split(' ').filter(t => t.length > 0);
  
  // For each token, add prefixes of length 1 to min(10, token.length)
  tokens.forEach(token => {
    const maxLen = Math.min(10, token.length);
    for (let len = 1; len <= maxLen; len++) {
      prefixes.add(token.substring(0, len));
    }
  });
  
  // Also add prefixes for the full normalized string (first 10 chars)
  const fullPrefix = normalizedText.substring(0, Math.min(10, normalizedText.length));
  for (let len = 1; len <= fullPrefix.length; len++) {
    prefixes.add(fullPrefix.substring(0, len));
  }
  
  return Array.from(prefixes).sort();
}

/**
 * Generate search key from name and aliases
 */
export function generateSearchKey(name: string, aliases: string[] = []): string {
  const allText = [name, ...aliases].join(' ');
  return normalize(allText);
}

/**
 * Search brokers by query (prefix-based)
 * Returns brokers where any prefix matches the normalized query
 */
export function searchBrokers(brokers: Array<{ prefixes: string[] }>, query: string): Array<{ prefixes: string[] }> {
  if (!query || query.trim().length === 0) {
    // Return top brokers (first 20) if no query
    return brokers.slice(0, 20);
  }
  
  const normalizedQuery = normalize(query);
  
  // Filter brokers where prefixes array contains the normalized query
  return brokers.filter(broker => 
    broker.prefixes.some(prefix => prefix === normalizedQuery || normalizedQuery.startsWith(prefix))
  ).slice(0, 20); // Limit to 20 results
}


