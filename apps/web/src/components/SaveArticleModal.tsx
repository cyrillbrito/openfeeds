import CircleAlertIcon from 'lucide-solid/icons/circle-alert';
import { createSignal, Show } from 'solid-js';
import { articlesCollection } from '~/entities/articles';
import { $$createArticle } from '~/entities/articles.server';
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

      // Create the article via server function
      const article = await $$createArticle({
        data: {
          url,
          tags: selectedTags().length > 0 ? selectedTags() : undefined,
        },
      });

      // Insert into local collection for immediate UI update
      articlesCollection.insert({
        id: article.id,
        feedId: null,
        title: article.title,
        url: article.url,
        description: article.description,
        content: article.content,
        author: article.author,
        pubDate: article.pubDate?.toISOString() ?? new Date().toISOString(),
        isRead: article.isRead ?? false,
        isArchived: article.isArchived ?? false,
        hasCleanContent: article.hasCleanContent,
        tags: article.tags,
        createdAt: article.createdAt.toISOString(),
      });

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

      <Show when={tagsQuery.data && tagsQuery.data.length > 0}>
        <div class="mb-4">
          <label class="label">
            <span class="label-text">Tags (optional)</span>
          </label>
          <MultiSelectTag
            tags={tagsQuery.data || []}
            selectedIds={selectedTags()}
            onSelectionChange={setSelectedTags}
          />
        </div>
      </Show>

      <Show when={error()}>
        <div class="alert alert-error mb-4">
          <CircleAlertIcon size={20} />
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
