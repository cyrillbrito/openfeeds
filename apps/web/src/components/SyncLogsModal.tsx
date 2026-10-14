import type { Feed } from '@repo/domain/client';
import { useEffect, useRef, useState } from 'react';
import { api, unwrap } from '~/lib/api-client';
import { LazyModal, type ModalController } from './LazyModal';
import { TimeAgo } from './TimeAgo';

interface SyncLogsModalProps {
  controller: (controller: ModalController) => void;
  feed: Feed | null;
}

export function SyncLogsModal({ controller, feed }: SyncLogsModalProps) {
  const modalRef = useRef<ModalController>(null!);

  return (
    <LazyModal
      controller={(c) => {
        modalRef.current = c;
        controller(c);
      }}
      className="max-w-[min(95vw,48rem)]"
      title="Sync Logs"
    >
      {feed && <SyncLogsContent feed={feed} />}
    </LazyModal>
  );
}

type SyncLog = Awaited<ReturnType<typeof fetchSyncLogs>>[number];

async function fetchSyncLogs(feedId: string) {
  return unwrap(api.api.feeds['sync-logs'].$get({ query: { feedId } }));
}

function SyncLogsContent({ feed }: { feed: Feed }) {
  const [logs, setLogs] = useState<SyncLog[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setErrorMessage(null);
    fetchSyncLogs(feed.id)
      .then(setLogs)
      .catch((err: unknown) => {
        setErrorMessage((err instanceof Error ? err : new Error('Unknown error')).message);
      })
      .finally(() => setIsLoading(false));
  }, [feed.id]);

  return (
    <div>
      <p className="text-base-content-gray mb-4 text-sm">
        Recent sync attempts for <span className="font-medium">{feed.title}</span>
      </p>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-md"></span>
        </div>
      ) : errorMessage ? (
        <div className="alert alert-error">
          <span>Failed to load sync logs: {errorMessage}</span>
        </div>
      ) : logs?.length === 0 ? (
        <p className="text-base-content-gray py-8 text-center text-sm">No sync logs yet.</p>
      ) : logs ? (
        <table className="table-sm table">
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
            {logs.map((log, i) => (
              <tr key={i}>
                <td className="whitespace-nowrap">
                  <TimeAgo date={new Date(log.createdAt)} tooltipBottom />
                </td>
                <td>
                  <StatusBadge status={log.status} />
                </td>
                <td className="text-base-content/60">{log.httpStatus ?? '-'}</td>
                <td className="text-base-content/60">
                  {log.durationMs != null ? `${log.durationMs}ms` : '-'}
                </td>
                <td>
                  {log.articlesAdded > 0 ? (
                    <span className="text-success font-medium">+{log.articlesAdded}</span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="text-error max-w-xs truncate" title={log.error ?? undefined}>
                  {log.error ?? '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  let badgeClass: string;
  switch (status) {
    case 'ok':
      badgeClass = 'badge-success';
      break;
    case 'skipped':
      badgeClass = 'badge-ghost';
      break;
    case 'failed':
      badgeClass = 'badge-error';
      break;
    default:
      badgeClass = 'badge-ghost';
  }

  return <span className={`badge badge-xs ${badgeClass}`}>{status}</span>;
}
