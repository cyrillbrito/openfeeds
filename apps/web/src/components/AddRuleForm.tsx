import { FilterOperator } from '@repo/domain/client';
import { createId } from '@repo/shared/utils';
import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { filterRulesCollection } from '~/entities/filter-rules';
import { authClient } from '~/lib/auth-client';

interface AddRuleFormProps {
  feedId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AddRuleForm({ feedId, onSuccess, onCancel }: AddRuleFormProps) {
  const session = authClient.useSession();
  const [pattern, setPattern] = useState('');
  const [operator, setOperator] = useState<(typeof FilterOperator)[keyof typeof FilterOperator]>(
    FilterOperator.INCLUDES,
  );
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPattern = pattern.trim();

    if (!trimmedPattern) {
      setError('Please enter a pattern');
      return;
    }

    const userId = session.data?.user?.id;
    if (!userId) {
      setError('Not authenticated');
      return;
    }

    setError(null);
    const now = new Date().toISOString();
    filterRulesCollection.insert({
      id: createId(),
      userId,
      feedId,
      pattern: trimmedPattern,
      operator,
      isActive,
      createdAt: now,
      updatedAt: now,
    });

    setPattern('');
    setOperator(FilterOperator.INCLUDES);
    setIsActive(true);

    onSuccess?.();
  };

  const handleCancel = () => {
    setPattern('');
    setOperator(FilterOperator.INCLUDES);
    setIsActive(true);
    setError(null);
    onCancel?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="form-control w-full">
        <label className="label">
          <span className="label-text">Text Pattern to Match</span>
        </label>
        <input
          type="text"
          placeholder="e.g., advertisement, sponsored, breaking"
          className="input input-bordered w-full"
          value={pattern}
          onChange={(e) => setPattern(e.currentTarget.value)}
          required
        />
        <label className="label">
          <span className="label-text-alt">
            Articles with titles matching this pattern will be automatically marked as read
          </span>
        </label>
      </div>

      <div className="form-control w-full">
        <label className="label">
          <span className="label-text">When to Mark as Read</span>
        </label>
        <div className="flex flex-col gap-3">
          {operatorOptions.map((option) => (
            <label
              key={option.value}
              className="label border-base-300 hover:bg-base-100 cursor-pointer justify-start gap-3 rounded-lg border p-3"
            >
              <input
                type="radio"
                name="operator"
                className="radio"
                value={option.value}
                checked={operator === option.value}
                onChange={() => setOperator(option.value)}
              />
              <div className="flex-1">
                <div className="label-text font-medium">{option.label}</div>
                <div className="label-text-alt mt-1 text-xs">{option.description}</div>
              </div>
            </label>
          ))}
        </div>
        <label className="label">
          <span className="label-text-alt">
            Choose when articles should be automatically marked as read
          </span>
        </label>
      </div>

      <div className="form-control">
        <label className="label cursor-pointer">
          <span className="label-text">Enable Rule</span>
          <input
            type="checkbox"
            className="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.currentTarget.checked)}
          />
        </label>
        <label className="label">
          <span className="label-text-alt">
            Disabled rules will not automatically mark articles as read
          </span>
        </label>
      </div>

      {error && (
        <div className="alert alert-error">
          <CircleAlert size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={handleCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          Add Rule
        </button>
      </div>
    </form>
  );
}
