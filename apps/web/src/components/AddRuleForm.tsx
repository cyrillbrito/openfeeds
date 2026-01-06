import { FilterOperator } from '@repo/shared/types';
import { createFilterRule } from '~/entities/filter-rules';
import CircleAlertIcon from 'lucide-solid/icons/circle-alert';
import { createSignal, For, Show } from 'solid-js';

interface AddRuleFormProps {
  feedId: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AddRuleForm(props: AddRuleFormProps) {
  const [pattern, setPattern] = createSignal('');
  const [operator, setOperator] = createSignal<
    (typeof FilterOperator)[keyof typeof FilterOperator]
  >(FilterOperator.INCLUDES);
  const [isActive, setIsActive] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  const operatorOptions = [
    {
      value: FilterOperator.INCLUDES,
      label: 'Title contains this text',
      description: 'Mark as read if title contains the pattern',
    },
    {
      value: FilterOperator.NOT_INCLUDES,
      label: 'Title does not contain this text',
      description: 'Mark as read if title does NOT contain the pattern',
    },
  ];

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const trimmedPattern = pattern().trim();

    if (!trimmedPattern) {
      setError('Please enter a pattern');
      return;
    }

    setError(null);
    createFilterRule(props.feedId, {
      pattern: trimmedPattern,
      operator: operator(),
      isActive: isActive(),
    });

    // Reset form
    setPattern('');
    setOperator(FilterOperator.INCLUDES);
    setIsActive(true);

    props.onSuccess?.();
  };

  const handleCancel = () => {
    setPattern('');
    setOperator(FilterOperator.INCLUDES);
    setIsActive(true);
    setError(null);
    props.onCancel?.();
  };

  return (
    <form onSubmit={handleSubmit} class="space-y-4">
      <div class="form-control w-full">
        <label class="label">
          <span class="label-text">Text Pattern to Match</span>
        </label>
        <input
          type="text"
          placeholder="e.g., advertisement, sponsored, breaking"
          class="input input-bordered w-full"
          value={pattern()}
          onInput={(e) => setPattern(e.currentTarget.value)}
          required
        />
        <label class="label">
          <span class="label-text-alt">
            Articles with titles matching this pattern will be automatically marked as read
          </span>
        </label>
      </div>

      <div class="form-control w-full">
        <label class="label">
          <span class="label-text">When to Mark as Read</span>
        </label>
        <div class="flex flex-col gap-3">
          <For each={operatorOptions}>
            {(option) => (
              <label class="label border-base-300 hover:bg-base-100 cursor-pointer justify-start gap-3 rounded-lg border p-3">
                <input
                  type="radio"
                  name="operator"
                  class="radio"
                  value={option.value}
                  checked={operator() === option.value}
                  onChange={() => setOperator(option.value)}
                />
                <div class="flex-1">
                  <div class="label-text font-medium">{option.label}</div>
                  <div class="label-text-alt mt-1 text-xs">{option.description}</div>
                </div>
              </label>
            )}
          </For>
        </div>
        <label class="label">
          <span class="label-text-alt">
            Choose when articles should be automatically marked as read
          </span>
        </label>
      </div>

      <div class="form-control">
        <label class="label cursor-pointer">
          <span class="label-text">Enable Rule</span>
          <input
            type="checkbox"
            class="checkbox"
            checked={isActive()}
            onChange={(e) => setIsActive(e.currentTarget.checked)}
          />
        </label>
        <label class="label">
          <span class="label-text-alt">
            Disabled rules will not automatically mark articles as read
          </span>
        </label>
      </div>

      <Show when={error()}>
        <div class="alert alert-error">
          <CircleAlertIcon size={20} />
          <span>{error()}</span>
        </div>
      </Show>

      <div class="flex justify-end gap-2">
        <button type="button" class="btn" onClick={handleCancel}>
          Cancel
        </button>
        <button type="submit" class="btn btn-primary">
          Add Rule
        </button>
      </div>
    </form>
  );
}
