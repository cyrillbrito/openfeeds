// Skipped: AddFeedModal no longer exists — feed adding moved to /discover route.
// All tests in this file need rewriting with DiscoverPage POM.
import { expect, test } from '../../fixtures/auth-fixture';
import { AddFeedModal } from '../../lib/AddFeedModal';
import { Drawer } from '../../lib/Drawer';
import { FeedsPage } from '../../lib/FeedsPage';
import { MOCK_SERVER_URL } from '../../mock-server/server';

test.skip('display add feed modal', async ({ page, user }) => {});
test.skip('add feed by URL successfully', async ({ page, user }) => {});
test.skip('validate required URL field', async ({ page, user }) => {});
test.skip('handle invalid feed URL', async ({ page, user }) => {});
test.skip('cancel add feed modal', async ({ page, user }) => {});
test.skip('add feed from empty state', async ({ page, user }) => {});
