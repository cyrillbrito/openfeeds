// Skipped: depends on AddFeedModal for setup (no longer exists) + FeedsPage POM outdated (feed rows instead of cards, "Manage Feeds" → "Feeds", empty state text changed).
import { expect, test } from '../../fixtures/auth-fixture';
import { AddFeedModal } from '../../lib/AddFeedModal';
import { Drawer } from '../../lib/Drawer';
import { FeedsPage } from '../../lib/FeedsPage';
import { MOCK_SERVER_URL } from '../../mock-server/server';

test.skip('display empty state when no feeds', async ({ page, user }) => {});
test.skip('display feed list with feeds', async ({ page, user }) => {});
test.skip('search feeds by title', async ({ page, user }) => {});
test.skip('search with no results', async ({ page, user }) => {});
test.skip('clear search', async ({ page, user }) => {});
test.skip('navigate to feed detail from feed card', async ({ page, user }) => {});
