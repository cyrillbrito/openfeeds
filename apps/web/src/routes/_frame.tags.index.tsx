import type { Tag } from '@repo/shared/types';
import { createFileRoute } from '@tanstack/solid-router';
import EllipsisVerticalIcon from 'lucide-solid/icons/ellipsis-vertical';
import PlusIcon from 'lucide-solid/icons/plus';
import { createSignal, For, Show, Suspense } from 'solid-js';
import { useTags } from '~/entities/tags';
import { Card } from '../components/Card';
import { ColorIndicator } from '../components/ColorIndicator';
import { DeleteTagModal } from '../components/DeleteTagModal';
import { Dropdown } from '../components/Dropdown';
import { Header } from '../components/Header';
import { TagsIllustration } from '../components/Icons';
import { type ModalController } from '../components/LazyModal';
import { TagModal } from '../components/TagModal';
import { TimeAgo } from '../components/TimeAgo';
import { getTagDotColor } from '../utils/tagColors';

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

      <div class="container mx-auto px-2 py-3 sm:p-6">
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
        <Suspense
          fallback={
            <div class="flex justify-center py-12">
              <span class="loading loading-spinner loading-lg"></span>
            </div>
          }
        >
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
            <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <For each={tagsQuery.data!}>
                {(tag) => (
                  <Card class="cursor-pointer hover:shadow-lg">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <ColorIndicator class={getTagDotColor(tag.color)} />
                        <h2 class="card-title">{tag.name}</h2>
                      </div>

                      <div onClick={(e) => e.stopPropagation()}>
                        <Dropdown
                          end
                          btnClasses="btn-circle btn-ghost"
                          btnContent={<EllipsisVerticalIcon size={20} />}
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

                    <div class="mt-4">
                      <div class="text-base-content-gray text-sm">
                        Created: <TimeAgo date={tag.createdAt} />
                      </div>
                    </div>
                  </Card>
                )}
              </For>
            </div>
          </Show>
        </Suspense>
      </div>
    </>
  );
}
