import { db, getTxId } from '@repo/db';
import * as filterRulesDomain from '@repo/domain';
import { CreateFilterRuleSchema, UpdateFilterRuleSchema, withTransaction } from '@repo/domain';
import type { Plan } from '@repo/domain/client';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$createFilterRules = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(CreateFilterRuleSchema))
  .handler(async ({ context, data }) => {
    return await withTransaction(db, context.user.id, context.user.plan as Plan, async (ctx) => {
      await filterRulesDomain.createFilterRules(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
  });

export const $$updateFilterRules = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(UpdateFilterRuleSchema))
  .handler(async ({ context, data }) => {
    return await withTransaction(db, context.user.id, context.user.plan as Plan, async (ctx) => {
      await filterRulesDomain.updateFilterRules(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
  });

export const $$deleteFilterRules = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.uuidv7()))
  .handler(async ({ context, data: ids }) => {
    return await withTransaction(db, context.user.id, context.user.plan as Plan, async (ctx) => {
      await filterRulesDomain.deleteFilterRules(ctx, ids);
      return { txid: await getTxId(ctx.conn) };
    });
  });
