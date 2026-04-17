#!/usr/bin/env bun

/**
 * One-off script: fix double-encoded chat_sessions.messages JSONB rows.
 *
 * The bun:sql driver auto-serializes objects, but Drizzle's built-in jsonb()
 * was also calling JSON.stringify(), causing double-encoding. This script
 * detects rows where `jsonb_typeof(messages) = 'string'` and unwraps them.
 *
 * Usage: bun --env-file=../../.env src/fix-chat-sessions.ts
 */
import { db } from '@repo/db';
import { sql } from 'drizzle-orm';

async function main() {
  // 1. Check current state
  const rows = await db.execute<{
    id: string;
    jtype: string;
    raw: string;
  }>(sql`
    SELECT id, jsonb_typeof(messages) as jtype, messages::text as raw
    FROM chat_sessions
    ORDER BY created_at DESC
  `);

  console.log(`Found ${rows.length} chat_sessions rows\n`);

  const broken = rows.filter((r) => r.jtype === 'string');
  const ok = rows.filter((r) => r.jtype === 'array');

  console.log(`  OK (array):         ${ok.length}`);
  console.log(`  Broken (string):    ${broken.length}`);

  if (broken.length === 0) {
    console.log('\nAll rows are correctly encoded. Nothing to fix.');
    process.exit(0);
  }

  console.log('\nFixing broken rows...\n');

  // 2. Fix: unwrap by casting the inner JSON string back to jsonb
  // messages is currently a jsonb string like '"[{...}]"'
  // (messages #>> '{}') extracts the text content of a jsonb string scalar
  // then ::jsonb parses that text as proper jsonb
  await db.execute(sql`
    UPDATE chat_sessions
    SET messages = (messages #>> '{}')::jsonb
    WHERE jsonb_typeof(messages) = 'string'
  `);

  console.log(`Updated ${broken.length} rows`);

  // 3. Verify
  const verify = await db.execute<{
    id: string;
    jtype: string;
  }>(sql`
    SELECT id, jsonb_typeof(messages) as jtype
    FROM chat_sessions
    WHERE jsonb_typeof(messages) = 'string'
  `);

  if (verify.length === 0) {
    console.log('\nVerification passed: all rows are now proper JSONB arrays.');
  } else {
    console.error(`\nVerification FAILED: ${verify.length} rows still double-encoded!`);
    // Might be triple-encoded — try one more unwrap
    console.log('Attempting second unwrap (triple-encoded)...');
    await db.execute(sql`
      UPDATE chat_sessions
      SET messages = (messages #>> '{}')::jsonb
      WHERE jsonb_typeof(messages) = 'string'
    `);
    const verify2 = await db.execute<{ cnt: number }>(sql`
      SELECT count(*)::int as cnt FROM chat_sessions WHERE jsonb_typeof(messages) = 'string'
    `);
    if (verify2[0].cnt === 0) {
      console.log('Second unwrap succeeded. All rows now correct.');
    } else {
      console.error(`Still ${verify2[0].cnt} broken rows — needs manual investigation.`);
      process.exit(1);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
