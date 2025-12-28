import DOMPurify from "dompurify";

/**
 * Sanitize user input to prevent XSS attacks
 * 
 * Removes all HTML tags and attributes, leaving only plain text.
 * Use this for any user-entered data that might be displayed:
 * - Notes, comments, descriptions
 * - Customer names, addresses
 * - Any free-text fields
 * 
 * @param input - Raw user input string
 * @returns Sanitized plain text string
 */
export function sanitizeText(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove all HTML tags and attributes, leaving only text
  const cleaned = DOMPurify.sanitize(input, { 
    ALLOWED_TAGS: [], 
    ALLOWED_ATTR: [] 
  });
  
  // Normalize whitespace (collapse multiple spaces/tabs/newlines to single space)
  return cleaned.replace(/\s+/g, " ").trim();
}

/**
 * Sanitize text but allow basic formatting (for rich text fields if needed)
 * 
 * WARNING: Only use this if you absolutely need HTML formatting.
 * Prefer sanitizeText() for most use cases.
 * 
 * @param input - Raw user input string
 * @returns Sanitized HTML string with basic formatting
 */
export function sanitizeHTML(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Allow only safe HTML tags (no scripts, iframes, etc.)
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [],
  });
}

/**
 * Validate email format (client-side validation)
 * 
 * @param email - Email string to validate
 * @returns true if email format is valid
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate URL format (client-side validation)
 * 
 * @param url - URL string to validate
 * @returns true if URL format is valid
 */
export function isValidURL(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}


