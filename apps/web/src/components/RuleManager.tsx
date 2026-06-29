import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { useFilterRules } from '~/entities/filter-rules';
import { api, unwrap } from '~/lib/api-client';
import { AddRuleForm } from './AddRuleForm';
import { RuleItem } from './RuleItem';

interface RuleManagerProps {
  feedId: string;
}

export function RuleManager({ feedId }: RuleManagerProps) {
  const rules = useFilterRules(feedId);

  const [showAddForm, setShowAddForm] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const activeRulesCount = rules.filter((rule) => rule.isActive).length;

  const handleApplyRules = async () => {
    try {
      setApplyError(null);
      setIsApplying(true);
      const result = await unwrap(
        api.api.actions['apply-filter-rules'].$post({ json: { feedId } }),
      );
      alert(
        `Applied rules to ${result.articlesProcessed} articles, marked ${result.articlesMarkedAsRead} as read.`,
      );
    } catch (err) {
      console.error('Failed to apply rules:', err);
      setApplyError(err instanceof Error ? err.message : 'Failed to apply rules');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Auto archive Rules</h3>
          <p className="text-base-content/70 text-sm">
            Rules automatically mark articles as read based on title patterns
          </p>
          <p className="text-base-content/60 text-xs">
            {rules.length === 0
              ? 'No rules configured'
              : `${rules.length} rule${rules.length === 1 ? '' : 's'} configured (${activeRulesCount} active)`}
          </p>
        </div>
        <div className="flex gap-2">
          {rules.length > 0 && (
            <button
              className="btn btn-sm btn-outline"
              onClick={handleApplyRules}
              disabled={isApplying || activeRulesCount === 0}
              title="Mark existing articles as read based on current rules"
            >
              {isApplying ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  Applying...
                </>
              ) : (
                'Mark Existing as Read'
              )}
            </button>
          )}
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? 'Cancel' : 'Add Rule'}
          </button>
        </div>
      </div>

      {applyError && (
        <div className="alert alert-error">
          <CircleAlert size={20} />
          <span>{applyError}</span>
        </div>
      )}

      {showAddForm && (
        <div className="card bg-base-200 p-4">
          <h4 className="text-md mb-2 font-medium">Add New Auto Archive Rule</h4>
          <p className="text-base-content/70 mb-3 text-sm">
            Articles matching this rule will be automatically marked as read when synced
          </p>
          <AddRuleForm
            feedId={feedId}
            onSuccess={() => setShowAddForm(false)}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      <div className="space-y-2">
        {rules.length > 0 ? (
          rules.map((rule) => (
            <RuleItem key={rule.id} rule={rule} />
          ))
        ) : (
          <div className="text-base-content/60 py-8 text-center">
            <p>No auto archive rules configured for this feed.</p>
            <p className="mt-1 text-sm">
              Create rules to automatically skip articles you don't want to read.
            </p>
            <p className="text-base-content/50 mt-2 text-xs">
              Example: Mark articles containing "advertisement" or "sponsored" as read
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
