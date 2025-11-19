/**
 * Security utility functions for input sanitization
 * Prevents XSS and injection attacks
 */

/**
 * Sanitize level name to prevent XSS attacks
 * Only allows alphanumeric characters, spaces, and safe punctuation
 * @param name - Raw level name input
 * @returns Sanitized level name
 */
export function sanitizeLevelName(name: string): string {
  if (typeof name !== 'string') {
    throw new Error('Level name must be a string');
  }

  // Remove any potentially dangerous characters
  // Allow: letters, numbers, spaces, hyphens, underscores, periods, exclamation marks, question marks
  const sanitized = name
    .replace(/[^a-zA-Z0-9 \-_\.!?]/g, '')
    .trim()
    .slice(0, 50); // Limit to 50 characters

  if (sanitized.length === 0) {
    throw new Error('Level name cannot be empty after sanitization');
  }

  return sanitized;
}

/**
 * Validate that a level name is safe
 * @param name - Level name to validate
 * @returns true if valid, throws error if invalid
 */
export function validateLevelName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    throw new Error('Level name is required and must be a string');
  }

  if (name.length === 0) {
    throw new Error('Level name cannot be empty');
  }

  if (name.length > 50) {
    throw new Error('Level name must be 50 characters or less');
  }

  // Check for potentially dangerous patterns
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+=/i, // Event handlers like onclick=
    /<iframe/i,
    /<embed/i,
    /<object/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(name)) {
      throw new Error('Level name contains potentially dangerous content');
    }
  }

  return true;
}

/**
 * Sanitize and validate level name in one step
 * Use this function before saving level names
 * @param name - Raw level name input
 * @returns Sanitized and validated level name
 */
export function processLevelName(name: string): string {
  const sanitized = sanitizeLevelName(name);
  validateLevelName(sanitized);
  return sanitized;
}
