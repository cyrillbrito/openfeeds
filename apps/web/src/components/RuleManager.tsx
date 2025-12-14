import CircleAlertIcon from 'lucide-solid/icons/circle-alert';
import { createSignal, For, Show } from 'solid-js';
import { useApplyFilterRules, useFilterRules } from '../hooks/queries';
import { AddRuleForm } from './AddRuleForm';
import { RuleItem } from './RuleItem';

interface RuleManagerProps {
  feedId: number;
}

export function RuleManager(props: RuleManagerProps) {
  const filterRulesQuery = useFilterRules(props.feedId);
  const applyRulesMutation = useApplyFilterRules();

  const [showAddForm, setShowAddForm] = createSignal(false);
  const [applyError, setApplyError] = createSignal<string | null>(null);

  const rules = () => filterRulesQuery.data || [];
  const activeRulesCount = () => rules().filter((rule) => rule.isActive).length;

  const handleAddSuccess = () => {
    setShowAddForm(false);
    void filterRulesQuery.refetch();
  };

  const handleAddCancel = () => {
    setShowAddForm(false);
  };

  const handleRuleUpdate = () => {
    void filterRulesQuery.refetch();
  };

  const handleRuleDelete = () => {
    void filterRulesQuery.refetch();
  };

  const handleApplyRules = async () => {
    try {
      setApplyError(null);
      const result = await applyRulesMutation.mutateAsync(props.feedId);

      // Show a success message or toast
      alert(
        `Applied rules to ${result.articlesProcessed} articles, marked ${result.articlesMarkedAsRead} as read.`,
      );
    } catch (err) {
      console.error('Failed to apply rules:', err);
      setApplyError(err instanceof Error ? err.message : 'Failed to apply rules');
    }
  };

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold">Auto archive Rules</h3>
          <p class="text-base-content/70 text-sm">
            Rules automatically mark articles as read based on title patterns
          </p>
          <p class="text-base-content/60 text-xs">
            {rules().length === 0
              ? 'No rules configured'
              : `${rules().length} rule${rules().length === 1 ? '' : 's'} configured (${activeRulesCount()} active)`}
          </p>
        </div>
        <div class="flex gap-2">
          <Show when={rules().length > 0}>
            <button
              class="btn btn-sm btn-outline"
              onClick={handleApplyRules}
              disabled={applyRulesMutation.isPending || activeRulesCount() === 0}
              title="Mark existing articles as read based on current rules"
            >
              <Show when={applyRulesMutation.isPending} fallback="Mark Existing as Read">
                <span class="loading loading-spinner loading-xs"></span>
                Applying...
              </Show>
            </button>
          </Show>
          <button class="btn btn-sm btn-primary" onClick={() => setShowAddForm(!showAddForm())}>
            {showAddForm() ? 'Cancel' : 'Add Rule'}
          </button>
        </div>
      </div>

      <Show when={applyError()}>
        <div class="alert alert-error">
          <CircleAlertIcon size={20} />
          <span>{applyError()}</span>
        </div>
      </Show>

      <Show when={showAddForm()}>
        <div class="card bg-base-200 p-4">
          <h4 class="text-md mb-2 font-medium">Add New Auto Archive Rule</h4>
          <p class="text-base-content/70 mb-3 text-sm">
            Articles matching this rule will be automatically marked as read when synced
          </p>
          <AddRuleForm
            feedId={props.feedId}
            onSuccess={handleAddSuccess}
            onCancel={handleAddCancel}
          />
        </div>
      </Show>

      <Show
        when={!filterRulesQuery.isLoading}
        fallback={
          <div class="flex justify-center py-4">
            <span class="loading loading-spinner loading-md"></span>
          </div>
        }
      >
        <Show
          when={rules().length > 0}
          fallback={
            <div class="text-base-content/60 py-8 text-center">
              <p>No auto archive rules configured for this feed.</p>
              <p class="mt-1 text-sm">
                Create rules to automatically skip articles you don't want to read.
              </p>
              <p class="text-base-content/50 mt-2 text-xs">
                Example: Mark articles containing "advertisement" or "sponsored" as read
              </p>
            </div>
          }
        >
          <div class="space-y-2">
            <For each={rules()}>
              {(rule) => (
                <RuleItem rule={rule} onUpdate={handleRuleUpdate} onDelete={handleRuleDelete} />
              )}
            </For>
          </div>
        </Show>
      </Show>

      <Show when={filterRulesQuery.isError}>
        <div class="alert alert-error">
          <CircleAlertIcon size={20} />
          <span>Failed to load filter rules. Please try again.</span>
        </div>
      </Show>
    </div>
  );
}
