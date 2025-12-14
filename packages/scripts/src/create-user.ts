#!/usr/bin/env bun
import { createAuthClient } from 'better-auth/client';

const apiUrl = process.env.API_URL || 'http://localhost:3001';

// Script-generated test users use @script-test.local domain
// E2E tests use @e2e-test.local domain
// This allows finding/deleting all test users with pattern: *@*-test.local
const SCRIPT_EMAIL_DOMAIN = '@script-test.local';

// Same pattern as e2e tests for consistency
const generateUniqueEmail = () => {
  const timestamp = Date.now();
  return `dev-${timestamp}${SCRIPT_EMAIL_DOMAIN}`;
};

const email = process.argv[2] || generateUniqueEmail();
const password = process.argv[3] || email; // Use email as password if not provided
const name = process.argv[4] || email.split('@')[0];

const authClient = createAuthClient({
  baseURL: apiUrl,
});

async function createUser() {
  try {
    const result = await authClient.signUp.email({
      email,
      password,
      name,
    });

    if (result.error) {
      console.error('❌ Error:', result.error.message);
      process.exit(1);
    }

    console.log('✅ User created successfully!');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('👤 Name:', name);
    console.log('🆔 User ID:', result.data?.user?.id);
    console.log('');
    console.log('You can now login with these credentials.');
  } catch (error: any) {
    console.error('❌ Error creating user:', error.message || error);
    process.exit(1);
  }
}

createUser();
