import { db, getTxId } from '@repo/db';
import * as filterRulesDomain from '@repo/domain';
import { CreateFilterRuleSchema, UpdateFilterRuleSchema } from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$createFilterRules = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(CreateFilterRuleSchema))
  .handler(async ({ context, data }) => {
    return await db.transaction(async (tx) => {
      await filterRulesDomain.createFilterRules(data, context.user.id, tx);
      return { txid: await getTxId(tx) };
    });
  });

export const $$updateFilterRules = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(UpdateFilterRuleSchema))
  .handler(async ({ context, data }) => {
    return await db.transaction(async (tx) => {
      await filterRulesDomain.updateFilterRules(data, context.user.id, tx);
      return { txid: await getTxId(tx) };
    });
  });

export const $$deleteFilterRules = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.uuidv7()))
  .handler(async ({ context, data: ids }) => {
    return await db.transaction(async (tx) => {
      await filterRulesDomain.deleteFilterRules(ids, context.user.id, tx);
      return { txid: await getTxId(tx) };
    });
  });
