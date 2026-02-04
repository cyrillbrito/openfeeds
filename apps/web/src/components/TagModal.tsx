import type { Tag, TagColor } from '@repo/shared/types';
import { createId } from '@repo/shared/utils';
import CircleAlertIcon from 'lucide-solid/icons/circle-alert';
import { createEffect, createSignal, For, Show } from 'solid-js';
import { tagsCollection } from '~/entities/tags';
import { availableTagColors, getTagDotColor } from '~/utils/tagColors';
import { ColorIndicator } from './ColorIndicator';
import { LazyModal, type ModalController } from './LazyModal';

interface TagModalProps {
  controller: (controller: ModalController) => void;
  editTag?: Tag | null;
  onEditComplete?: () => void;
}

export function TagModal(props: TagModalProps) {
  let modalController!: ModalController;
  const isEditMode = () => !!props.editTag;

  return (
    <LazyModal
      controller={(controller) => {
        modalController = controller;
        props.controller(controller);
      }}
      class="max-w-md"
      title={isEditMode() ? 'Edit Tag' : 'Create New Tag'}
      // onClose={resetForm}
      // disableBackdropClose={false} // Tag modals allow backdrop close
    >
      <TagForm
        editTag={props.editTag}
        onEditComplete={props.onEditComplete}
        onClose={() => modalController.close()}
      />
    </LazyModal>
  );
}

interface TagFormProps {
  editTag?: Tag | null;
  onEditComplete?: () => void;
  onClose: () => void;
}

export function TagForm(props: TagFormProps) {
  const isEditMode = () => !!props.editTag;

  const [tagName, setTagName] = createSignal('');
  const [tagColor, setTagColor] = createSignal<TagColor>(null);
  const [error, setError] = createSignal<string | null>(null);

  // Reset form when editTag changes (for edit mode)
  createEffect(() => {
    const editTag = props.editTag;
    if (editTag) {
      setTagName(editTag.name);
      setTagColor(editTag.color);
    } else {
      setTagName('');
      setTagColor(null);
    }
    setError(null);
  });

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const name = tagName().trim();

    if (!name) {
      setError('Tag name is required');
      return;
    }

    setError(null);

    if (isEditMode()) {
      tagsCollection.update(props.editTag!.id, (draft) => {
        draft.name = name;
        draft.color = tagColor();
      });
      props.onEditComplete?.();
    } else {
      tagsCollection.insert({
        id: createId(),
        name,
        color: tagColor(),
        createdAt: new Date().toISOString(),
      });
    }

    setTagName('');
    setTagColor(null);
    props.onClose();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div class="form-control mb-4 w-full">
        <label class="label">
          <span class="label-text">Tag Name</span>
        </label>
        <input
          type="text"
          placeholder="Enter tag name"
          class="input input-bordered w-full"
          value={tagName()}
          onInput={(e) => setTagName(e.currentTarget.value)}
          required
        />
      </div>

      <div class="form-control mb-4 w-full">
        <label class="label">
          <span class="label-text">Tag Color</span>
        </label>
        <div class="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            class={`badge badge-md sm:badge-lg border-base-300 cursor-pointer gap-1.5 border px-3 py-2 transition-all sm:gap-2 sm:px-4 sm:py-3 ${
              tagColor() === null
                ? 'ring-primary ring-2'
                : 'hover:ring-base-content/20 hover:ring-1'
            }`}
            onClick={() => setTagColor(null)}
            title="Default (gray)"
          >
            <ColorIndicator class={getTagDotColor(null)} />
            <span class="text-xs sm:text-sm">Default</span>
          </button>
          <For each={availableTagColors}>
            {(colorOption) => (
              <button
                type="button"
                class={`badge badge-md sm:badge-lg border-base-300 cursor-pointer gap-1.5 border px-3 py-2 transition-all sm:gap-2 sm:px-4 sm:py-3 ${
                  tagColor() === colorOption
                    ? 'ring-primary ring-2'
                    : 'hover:ring-base-content/20 hover:ring-1'
                }`}
                onClick={() => setTagColor(colorOption)}
                title={colorOption}
              >
                <ColorIndicator class={getTagDotColor(colorOption)} />
                <span class="text-xs capitalize sm:text-sm">{colorOption}</span>
              </button>
            )}
          </For>
        </div>
      </div>

      <Show when={error()}>
        <div class="alert alert-error mb-4">
          <CircleAlertIcon size={20} />
          <span>{error()}</span>
        </div>
      </Show>

      <div class="modal-action">
        <button type="button" class="btn" onClick={() => props.onClose()}>
          Cancel
        </button>
        <button type="submit" class="btn btn-primary">
          {isEditMode() ? 'Update Tag' : 'Create Tag'}
        </button>
      </div>
    </form>
  );
}
