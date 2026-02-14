import { createId } from '@repo/shared/utils';
import { CircleAlert } from 'lucide-solid';
import { createSignal, Show } from 'solid-js';
import { articleTagsCollection } from '~/entities/article-tags';
import { articlesCollection } from '~/entities/articles';
import { useTags } from '~/entities/tags';
import { LazyModal, type ModalController } from './LazyModal';
import { MultiSelectTag } from './MultiSelectTag';

interface SaveArticleModalProps {
  controller: (controller: ModalController) => void;
}

export function SaveArticleModal(props: SaveArticleModalProps) {
  let modalController!: ModalController;

  return (
    <LazyModal
      controller={(controller) => {
        modalController = controller;
        props.controller(controller);
      }}
      title="Save Article"
    >
      <SaveArticleForm onClose={() => modalController.close()} />
    </LazyModal>
  );
}

interface SaveArticleFormProps {
  onClose: () => void;
}

function SaveArticleForm(props: SaveArticleFormProps) {
  const [isSaving, setIsSaving] = createSignal(false);
  const [articleUrl, setArticleUrl] = createSignal('');
  const [selectedTags, setSelectedTags] = createSignal<string[]>([]);
  const [error, setError] = createSignal<string | null>(null);

  const tagsQuery = useTags();

  const handleSaveArticle = async (e: Event) => {
    e.preventDefault();
    const url = articleUrl().trim();

    if (!url) {
      setError('Please enter a valid URL');
      return;
    }

    try {
      setError(null);
      setIsSaving(true);

      const articleId = createId();

      // Insert into collection - onInsert will call server and update with real data
      articlesCollection.insert({
        id: articleId,
        feedId: null,
        title: url, // Placeholder, will be updated by onInsert
        url,
        description: null,
        content: null,
        author: null,
        pubDate: new Date().toISOString(),
        isRead: false,
        isArchived: false,
        cleanContent: null,
        contentExtractedAt: null,
        hasCleanContent: false,
        createdAt: new Date().toISOString(),
      });

      // Add tags if selected (using article tags collection)
      const tagsToAdd = selectedTags();
      if (tagsToAdd.length > 0) {
        for (const tagId of tagsToAdd) {
          articleTagsCollection.insert({
            id: createId(),
            userId: '', // Will be set by server
            articleId,
            tagId,
          });
        }
      }

      props.onClose();
    } catch (err) {
      console.error('Failed to save article:', err);
      setError(err instanceof Error ? err.message : 'Failed to save article');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSaveArticle}>
      <div class="form-control mb-4 w-full">
        <label class="label">
          <span class="label-text">Article URL</span>
        </label>
        <input
          type="url"
          placeholder="https://example.com/article"
          class="input input-bordered w-full"
          value={articleUrl()}
          onInput={(e) => setArticleUrl(e.currentTarget.value)}
          required
        />
      </div>

      <Show when={tagsQuery() && tagsQuery()!.length > 0}>
        <div class="mb-4">
          <label class="label">
            <span class="label-text">Tags (optional)</span>
          </label>
          <MultiSelectTag
            tags={tagsQuery() || []}
            selectedIds={selectedTags()}
            onSelectionChange={setSelectedTags}
          />
        </div>
      </Show>

      <Show when={error()}>
        <div class="alert alert-error mb-4">
          <CircleAlert size={20} />
          <span>{error()}</span>
        </div>
      </Show>

      <div class="modal-action">
        <button type="button" class="btn" onClick={() => props.onClose()} disabled={isSaving()}>
          Cancel
        </button>
        <button type="submit" class="btn btn-primary" disabled={isSaving()}>
          <Show when={isSaving()}>
            <span class="loading loading-spinner"></span>
          </Show>
          {isSaving() ? 'Saving...' : 'Save Article'}
        </button>
      </div>
    </form>
  );
}
