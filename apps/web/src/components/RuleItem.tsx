import { FilterOperator, type FilterRule } from '@repo/domain/client';
import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { filterRulesCollection } from '~/entities/filter-rules';

interface RuleItemProps {
  rule: FilterRule;
  onUpdate?: () => void;
  onDelete?: () => void;
}

export function RuleItem({ rule, onUpdate, onDelete }: RuleItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editPattern, setEditPattern] = useState(rule.pattern);
  const [editOperator, setEditOperator] = useState(rule.operator);
  const [editIsActive, setEditIsActive] = useState(rule.isActive);
  const [error, setError] = useState<string | null>(null);

  const operatorOptions = [
    { value: FilterOperator.INCLUDES, label: 'Title contains this text' },
    { value: FilterOperator.NOT_INCLUDES, label: 'Title does not contain this text' },
  ];

  const getOperatorLabel = (op: (typeof FilterOperator)[keyof typeof FilterOperator]) =>
    operatorOptions.find((option) => option.value === op)?.label || op;

  const handleEdit = () => {
    setEditPattern(rule.pattern);
    setEditOperator(rule.operator);
    setEditIsActive(rule.isActive);
    setIsEditing(true);
    setError(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setError(null);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPattern = editPattern.trim();

    if (!trimmedPattern) {
      setError('Please enter a pattern');
      return;
    }

    setError(null);
    filterRulesCollection.update(rule.id, (draft) => {
      draft.pattern = trimmedPattern;
      draft.operator = editOperator;
      draft.isActive = editIsActive;
      draft.updatedAt = new Date().toISOString();
    });

    setIsEditing(false);
    onUpdate?.();
  };

  const handleDelete = () => {
    if (!confirm('Are you sure you want to delete this filter rule?')) return;
    filterRulesCollection.delete(rule.id);
    onDelete?.();
  };

  const handleToggleActive = () => {
    filterRulesCollection.update(rule.id, (draft) => {
      draft.isActive = !rule.isActive;
      draft.updatedAt = new Date().toISOString();
    });
    onUpdate?.();
  };

  return (
    <div className="card bg-base-100 border-base-300 border p-4">
      {isEditing ? (
        <form onSubmit={handleSaveEdit} className="space-y-3">
          <div className="form-control w-full">
            <input
              type="text"
              placeholder="Pattern"
              className="input input-sm input-bordered w-full"
              value={editPattern}
              onChange={(e) => setEditPattern(e.currentTarget.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex gap-4">
              {operatorOptions.map((option) => (
                <label key={option.value} className="label cursor-pointer justify-start gap-2">
                  <input
                    type="radio"
                    name={`edit-operator-${rule.id}`}
                    className="radio radio-sm"
                    value={option.value}
                    checked={editOperator === option.value}
                    onChange={() => setEditOperator(option.value)}
                  />
                  <span className="label-text text-sm">{option.label}</span>
                </label>
              ))}
            </div>

            <label className="label cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={editIsActive}
                onChange={(e) => setEditIsActive(e.currentTarget.checked)}
              />
              <span className="label-text text-sm">Enable rule</span>
            </label>
          </div>

          {error && (
            <div className="alert alert-error alert-sm">
              <CircleAlert size={16} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-sm" onClick={handleCancelEdit}>
              Cancel
            </button>
            <button type="submit" className="btn btn-sm btn-primary">
              Save
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className={`badge ${rule.isActive ? 'badge-success' : 'badge-neutral'}`}>
                {rule.isActive ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="text-sm">
              <p className="mb-1">
                <span className="font-medium">Mark as read when:</span>{' '}
                <span className="text-base-content/80">
                  {getOperatorLabel(rule.operator).toLowerCase()}
                </span>
              </p>
              <p className="bg-base-200 rounded px-2 py-1 font-mono text-sm">
                "{rule.pattern}"
              </p>
            </div>
            {rule.updatedAt && (
              <p className="text-base-content/60 mt-1 text-xs">
                Updated: {new Date(rule.updatedAt).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-sm"
              onClick={handleToggleActive}
              title={rule.isActive ? 'Disable rule' : 'Enable rule'}
            >
              {rule.isActive ? 'Disable' : 'Enable'}
            </button>
            <button className="btn btn-sm" onClick={handleEdit}>
              Edit
            </button>
            <button className="btn btn-sm btn-error" onClick={handleDelete}>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
