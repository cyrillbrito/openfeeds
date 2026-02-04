import type { Tag } from '@repo/shared/types';
import { createFileRoute } from '@tanstack/solid-router';
import EllipsisVerticalIcon from 'lucide-solid/icons/ellipsis-vertical';
import PlusIcon from 'lucide-solid/icons/plus';
import { createSignal, For, Show, Suspense } from 'solid-js';
import { ColorIndicator } from '~/components/ColorIndicator';
import { DeleteTagModal } from '~/components/DeleteTagModal';
import { Dropdown } from '~/components/Dropdown';
import { Header } from '~/components/Header';
import { TagsIllustration } from '~/components/Icons';
import { type ModalController } from '~/components/LazyModal';
import { CenterLoader } from '~/components/Loader';
import { TagModal } from '~/components/TagModal';
import { TimeAgo } from '~/components/TimeAgo';
import { useTags } from '~/entities/tags';
import { getTagDotColor } from '~/utils/tagColors';

export const Route = createFileRoute('/_frame/tags/')({
  component: TagsComponent,
});

function TagsComponent() {
  const tagsQuery = useTags();

  // Modal controllers
  let tagModalController!: ModalController;
  let deleteModalController!: ModalController;

  // Edit tag state
  const [editingTag, setEditingTag] = createSignal<Tag | null>(null);

  // Delete confirmation state
  const [tagToDelete, setTagToDelete] = createSignal<Tag | null>(null);

  const handleEditTag = (tag: Tag) => {
    setEditingTag(tag);
    tagModalController.open();
  };

  const handleCreateTag = () => {
    setEditingTag(null); // Clear any existing edit state
    tagModalController.open();
  };

  return (
    <>
      <Header title="Manage Tags">
        <button class="btn btn-primary btn-sm" onClick={handleCreateTag}>
          <PlusIcon size={20} />
          <span class="hidden sm:inline">Create Tag</span>
        </button>
      </Header>

      <div class="mx-auto w-full max-w-2xl px-2 py-3 sm:p-6">
        <div class="mb-6">
          <p class="text-base-content-gray">Organize your feeds with custom tags and colors</p>
        </div>

        <TagModal
          controller={(controller) => (tagModalController = controller)}
          editTag={editingTag()}
          onEditComplete={() => setEditingTag(null)}
        />

        <DeleteTagModal
          controller={(controller) => (deleteModalController = controller)}
          tag={tagToDelete()}
          onDeleteComplete={() => setTagToDelete(null)}
          onClose={() => setTagToDelete(null)}
        />
        <Suspense fallback={<CenterLoader />}>
          <Show
            when={tagsQuery.data && tagsQuery.data.length > 0}
            fallback={
              <div class="py-16 text-center">
                <div class="mb-8 flex justify-center">
                  <TagsIllustration />
                </div>

                <h2 class="mb-4 text-3xl font-bold">No Tags Yet</h2>
                <p class="text-base-content-gray mx-auto mb-8 max-w-md">
                  Create tags to organize and categorize your RSS feeds. Tags help you quickly find
                  and filter related content.
                </p>

                <button class="btn btn-primary btn-lg" onClick={() => tagModalController.open()}>
                  <PlusIcon size={20} class="mr-2" />
                  Create Your First Tag
                </button>
              </div>
            }
          >
            <div class="grid grid-cols-2 gap-3">
              <For each={tagsQuery.data!}>
                {(tag) => (
                  <div class="border-base-300 bg-base-100 flex items-center justify-between gap-2 rounded-lg border px-3 py-3 shadow-sm">
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <ColorIndicator class={getTagDotColor(tag.color)} />
                        <span class="truncate font-medium">{tag.name}</span>
                      </div>
                      <div class="text-base-content-gray mt-1 text-xs">
                        Created <TimeAgo date={tag.createdAt} />
                      </div>
                    </div>

                    <div onClick={(e) => e.stopPropagation()}>
                      <Dropdown
                        end
                        btnClasses="btn-circle btn-ghost btn-sm"
                        btnContent={<EllipsisVerticalIcon size={16} />}
                      >
                        <li>
                          <button onClick={() => handleEditTag(tag)}>Edit</button>
                        </li>
                        <li>
                          <button
                            class="text-error"
                            onClick={() => {
                              setTagToDelete(tag);
                              deleteModalController.open();
                            }}
                          >
                            Delete
                          </button>
                        </li>
                      </Dropdown>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Suspense>
      </div>
    </>
  );
}
