const TEST_EMAIL_DOMAIN = '@e2e-test.local';

/**
 * Generate a unique random email for testing
 * Uses timestamp + random string to ensure uniqueness across parallel tests
 */
export function generateTestEmail() {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  return `test-${timestamp}-${randomString}${TEST_EMAIL_DOMAIN}`;
}

/**
 * Generate a random password meeting common requirements
 * @param length - Password length (default: 12)
 */
export function generateTestPassword(length: number = 12) {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';

  const allChars = lowercase + uppercase + numbers + symbols;

  // Ensure at least one character from each category
  let password = '';
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // Fill remaining length with random characters
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password to avoid predictable patterns
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}
