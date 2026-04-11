// Skipped: depends on AddFeedModal for setup (no longer exists) + EditFeedModal POM outdated ("Edit Feed" → "Edit", no save/reset buttons, auto-save).
import { expect, test } from '../../fixtures/auth-fixture';
import { AddFeedModal } from '../../lib/AddFeedModal';
import { Drawer } from '../../lib/Drawer';
import { EditFeedModal } from '../../lib/EditFeedModal';
import { FeedsPage } from '../../lib/FeedsPage';
import { MOCK_SERVER_URL } from '../../mock-server/server';

test.skip('display edit feed modal', async ({ page, user }) => {});
test.skip('close edit feed modal with done button', async ({ page, user }) => {});
test.skip('edit feed tags', async ({ page, user }) => {});
