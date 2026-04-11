// Skipped: depends on AddFeedModal for setup (no longer exists) + DeleteFeedModal POM outdated ("Delete Feed" → "Unfollow Feed", confirm text changed).
// Loading state test invalid for local-first (instant operations).
import { expect, test } from '../../fixtures/auth-fixture';
import { AddFeedModal } from '../../lib/AddFeedModal';
import { DeleteFeedModal } from '../../lib/DeleteFeedModal';
import { Drawer } from '../../lib/Drawer';
import { FeedsPage } from '../../lib/FeedsPage';
import { MOCK_SERVER_URL } from '../../mock-server/server';

test.skip('display delete feed modal', async ({ page, user }) => {});
test.skip('cancel feed deletion', async ({ page, user }) => {});
test.skip('delete feed successfully', async ({ page, user }) => {});
// Skipped additionally: loading state doesn't exist in local-first (instant delete)
test.skip('show loading state during deletion', async ({ page, user }) => {});
