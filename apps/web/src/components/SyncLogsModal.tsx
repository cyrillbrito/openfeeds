import type { Feed } from '@repo/domain/client';
import { createResource, For, Match, Show, Switch } from 'solid-js';
import { $$getFeedSyncLogs } from '~/entities/feeds.functions';
import { LazyModal, type ModalController } from './LazyModal';
import { TimeAgo } from './TimeAgo';

interface SyncLogsModalProps {
  controller: (controller: ModalController) => void;
  feed: Feed | null;
}

export function SyncLogsModal(props: SyncLogsModalProps) {
  return (
    <LazyModal
      controller={(c) => props.controller(c)}
      class="max-w-[min(95vw,48rem)]"
      title="Sync Logs"
    >
      <Show when={props.feed}>{(feed) => <SyncLogsContent feed={feed()} />}</Show>
    </LazyModal>
  );
}

function SyncLogsContent(props: { feed: Feed }) {
  const [logs] = createResource(
    () => props.feed.id,
    (feedId) => $$getFeedSyncLogs({ data: { feedId } }),
  );

  return (
    <div>
      <p class="text-base-content-gray mb-4 text-sm">
        Recent sync attempts for <span class="font-medium">{props.feed.title}</span>
      </p>

      <Switch>
        <Match when={logs.loading}>
          <div class="flex justify-center py-8">
            <span class="loading loading-spinner loading-md"></span>
          </div>
        </Match>
        <Match when={logs.error}>
          <div class="alert alert-error">
            <span>Failed to load sync logs: {(logs.error as Error).message}</span>
          </div>
        </Match>
        <Match when={logs()?.length === 0}>
          <p class="text-base-content-gray py-8 text-center text-sm">No sync logs yet.</p>
        </Match>
        <Match when={logs()}>
          <table class="table-sm table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Status</th>
                <th>HTTP</th>
                <th>Duration</th>
                <th>Articles</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              <For each={logs()}>
                {(log) => (
                  <tr>
                    <td class="whitespace-nowrap">
                      <TimeAgo date={new Date(log.createdAt)} tooltipBottom />
                    </td>
                    <td>
                      <StatusBadge status={log.status} />
                    </td>
                    <td class="text-base-content/60">{log.httpStatus ?? '-'}</td>
                    <td class="text-base-content/60">
                      {log.durationMs != null ? `${log.durationMs}ms` : '-'}
                    </td>
                    <td>
                      <Show when={log.articlesAdded > 0} fallback="-">
                        <span class="text-success font-medium">+{log.articlesAdded}</span>
                      </Show>
                    </td>
                    <td class="text-error max-w-xs truncate" title={log.error ?? undefined}>
                      {log.error ?? '-'}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </Match>
      </Switch>
    </div>
  );
}

function StatusBadge(props: { status: string }) {
  const badgeClass = () => {
    switch (props.status) {
      case 'ok':
        return 'badge-success';
      case 'skipped':
        return 'badge-ghost';
      case 'failed':
        return 'badge-error';
      default:
        return 'badge-ghost';
    }
  };

  return <span class={`badge badge-xs ${badgeClass()}`}>{props.status}</span>;
}
