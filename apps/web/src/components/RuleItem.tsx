import { FilterOperator, type FilterRule } from '@repo/domain/client';
import { CircleAlert } from 'lucide-solid';
import { createSignal, For, Show } from 'solid-js';
import { filterRulesCollection } from '~/entities/filter-rules';

interface RuleItemProps {
  rule: FilterRule;
  onUpdate?: () => void;
  onDelete?: () => void;
}

export function RuleItem(props: RuleItemProps) {
  const [isEditing, setIsEditing] = createSignal(false);
  const [editPattern, setEditPattern] = createSignal(props.rule.pattern);
  const [editOperator, setEditOperator] = createSignal(props.rule.operator);
  const [editIsActive, setEditIsActive] = createSignal(props.rule.isActive);
  const [error, setError] = createSignal<string | null>(null);

  const operatorOptions = [
    { value: FilterOperator.INCLUDES, label: 'Title contains this text' },
    { value: FilterOperator.NOT_INCLUDES, label: 'Title does not contain this text' },
  ];

  const getOperatorLabel = (op: (typeof FilterOperator)[keyof typeof FilterOperator]) => {
    return operatorOptions.find((option) => option.value === op)?.label || op;
  };

  const handleEdit = () => {
    setEditPattern(props.rule.pattern);
    setEditOperator(props.rule.operator);
    setEditIsActive(props.rule.isActive);
    setIsEditing(true);
    setError(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setError(null);
  };

  const handleSaveEdit = (e: Event) => {
    e.preventDefault();
    const trimmedPattern = editPattern().trim();

    if (!trimmedPattern) {
      setError('Please enter a pattern');
      return;
    }

    setError(null);
    filterRulesCollection.update(props.rule.id, (draft) => {
      draft.pattern = trimmedPattern;
      draft.operator = editOperator();
      draft.isActive = editIsActive();
      draft.updatedAt = new Date().toISOString();
    });

    setIsEditing(false);
    props.onUpdate?.();
  };

  const handleDelete = () => {
    if (!confirm('Are you sure you want to delete this filter rule?')) {
      return;
    }

    filterRulesCollection.delete(props.rule.id);
    props.onDelete?.();
  };

  const handleToggleActive = () => {
    filterRulesCollection.update(props.rule.id, (draft) => {
      draft.isActive = !props.rule.isActive;
      draft.updatedAt = new Date().toISOString();
    });
    props.onUpdate?.();
  };

  return (
    <div class="card bg-base-100 border-base-300 border p-4">
      <Show
        when={isEditing()}
        fallback={
          <div class="flex items-center justify-between gap-4">
            <div class="flex-1">
              <div class="mb-1 flex items-center gap-2">
                <span class={`badge ${props.rule.isActive ? 'badge-success' : 'badge-neutral'}`}>
                  {props.rule.isActive ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div class="text-sm">
                <p class="mb-1">
                  <span class="font-medium">Mark as read when:</span>{' '}
                  <span class="text-base-content/80">
                    {getOperatorLabel(props.rule.operator).toLowerCase()}
                  </span>
                </p>
                <p class="bg-base-200 rounded px-2 py-1 font-mono text-sm">
                  "{props.rule.pattern}"
                </p>
              </div>
              <Show when={props.rule.updatedAt}>
                <p class="text-base-content/60 mt-1 text-xs">
                  Updated: {new Date(props.rule.updatedAt!).toLocaleString()}
                </p>
              </Show>
            </div>
            <div class="flex gap-2">
              <button
                class="btn btn-sm"
                onClick={handleToggleActive}
                title={props.rule.isActive ? 'Disable rule' : 'Enable rule'}
              >
                {props.rule.isActive ? 'Disable' : 'Enable'}
              </button>
              <button class="btn btn-sm" onClick={handleEdit}>
                Edit
              </button>
              <button class="btn btn-sm btn-error" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSaveEdit} class="space-y-3">
          <div class="form-control w-full">
            <input
              type="text"
              placeholder="Pattern"
              class="input input-sm input-bordered w-full"
              value={editPattern()}
              onInput={(e) => setEditPattern(e.currentTarget.value)}
              required
            />
          </div>

          <div class="space-y-2">
            <div class="flex gap-4">
              <For each={operatorOptions}>
                {(option) => (
                  <label class="label cursor-pointer justify-start gap-2">
                    <input
                      type="radio"
                      name={`edit-operator-${props.rule.id}`}
                      class="radio radio-sm"
                      value={option.value}
                      checked={editOperator() === option.value}
                      onChange={() => setEditOperator(option.value)}
                    />
                    <span class="label-text text-sm">{option.label}</span>
                  </label>
                )}
              </For>
            </div>

            <label class="label cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                class="checkbox checkbox-sm"
                checked={editIsActive()}
                onChange={(e) => setEditIsActive(e.currentTarget.checked)}
              />
              <span class="label-text text-sm">Enable rule</span>
            </label>
          </div>

          <Show when={error()}>
            <div class="alert alert-error alert-sm">
              <CircleAlert size={16} />
              <span class="text-sm">{error()}</span>
            </div>
          </Show>

          <div class="flex justify-end gap-2">
            <button type="button" class="btn btn-sm" onClick={handleCancelEdit}>
              Cancel
            </button>
            <button type="submit" class="btn btn-sm btn-primary">
              Save
            </button>
          </div>
        </form>
      </Show>
    </div>
  );
}
