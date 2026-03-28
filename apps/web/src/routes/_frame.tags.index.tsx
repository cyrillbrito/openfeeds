import { move } from '@dnd-kit/helpers';
import { DragDropProvider } from '@dnd-kit/solid';
import { useSortable } from '@dnd-kit/solid/sortable';
import type { Tag } from '@repo/domain/client';
import { createFileRoute } from '@tanstack/solid-router';
import { EllipsisVertical, GripVertical, Plus } from 'lucide-solid';
import { createSignal, For, Show, Suspense } from 'solid-js';
import { ColorIndicator } from '~/components/ColorIndicator';
import { DeleteTagModal } from '~/components/DeleteTagModal';
import { Dropdown } from '~/components/Dropdown';
import { TagsIllustration } from '~/components/Icons';
import type { ModalController } from '~/components/LazyModal';
import { CenterLoader } from '~/components/Loader';
import { PageLayout } from '~/components/PageLayout';
import { TagModal } from '~/components/TagModal';
import { TimeAgo } from '~/components/TimeAgo';
import { tagsCollection, useTags } from '~/entities/tags';
import { getTagDotColor } from '~/utils/tagColors';

export const Route = createFileRoute('/_frame/tags/')({
  component: TagsComponent,
});

function SortableTagItem(props: {
  tag: Tag;
  index: number;
  onEdit: (tag: Tag) => void;
  onDelete: (tag: Tag) => void;
}) {
  const { ref, handleRef, isDragging } = useSortable({
    get id() {
      return props.tag.id;
    },
    get index() {
      return props.index;
    },
    transition: {
      duration: 200,
      easing: 'ease',
      idle: true,
    },
  });

  return (
    <div
      ref={ref}
      class="border-base-300 bg-base-100 flex items-center gap-2 rounded-lg border px-3 py-3 shadow-sm"
      style={{ opacity: isDragging() ? 0.5 : 1 }}
    >
      <button
        ref={handleRef}
        class="text-base-content/50 hover:text-base-content/80 shrink-0 cursor-grab touch-none p-1 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical size={20} />
      </button>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <ColorIndicator class={getTagDotColor(props.tag.color)} />
          <span class="truncate font-medium">{props.tag.name}</span>
        </div>
        <div class="text-base-content-gray mt-1 text-xs">
          Created <TimeAgo date={props.tag.createdAt} />
        </div>
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        <Dropdown
          end
          btnClasses="btn-circle btn-ghost btn-sm"
          btnContent={<EllipsisVertical size={16} />}
        >
          <li>
            <button onClick={() => props.onEdit(props.tag)}>Edit</button>
          </li>
          <li>
            <button class="text-error" onClick={() => props.onDelete(props.tag)}>
              Delete
            </button>
          </li>
        </Dropdown>
      </div>
    </div>
  );
}

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
    setEditingTag(null);
    tagModalController.open();
  };

  const handleDeleteTag = (tag: Tag) => {
    setTagToDelete(tag);
    deleteModalController.open();
  };

  return (
    <PageLayout
      title="Manage Tags"
      headerActions={
        <button class="btn btn-primary btn-sm" onClick={handleCreateTag}>
          <Plus size={20} />
          <span class="hidden sm:inline">Create Tag</span>
        </button>
      }
    >
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
          when={tagsQuery() && tagsQuery().length > 0}
          fallback={
            <div class="py-16 text-center">
              <div class="mb-8 flex justify-center">
                <TagsIllustration />
              </div>

              <h2 class="mb-4 text-3xl font-bold">No Tags Yet</h2>
              <p class="text-base-content-gray mx-auto mb-8 max-w-md">
                Create tags to organize and categorize your feeds. Tags help you quickly find and
                filter related content.
              </p>

              <button class="btn btn-primary btn-lg" onClick={() => tagModalController.open()}>
                <Plus size={20} class="mr-2" />
                Create Your First Tag
              </button>
            </div>
          }
        >
          <DragDropProvider
            onDragEnd={(event) => {
              const tags = tagsQuery();
              if (!tags) return;

              const updated = move(tags, event);
              if (updated === tags) return;

              // Optimistically update order via the collection so local-first sync works
              for (let i = 0; i < updated.length; i++) {
                const tag = updated[i];
                if (tag && tag.order !== i) {
                  tagsCollection.update(tag.id, (draft) => {
                    draft.order = i;
                  });
                }
              }
            }}
          >
            <div class="flex flex-col gap-2">
              <For each={tagsQuery()}>
                {(tag, index) => (
                  <SortableTagItem
                    tag={tag}
                    index={index()}
                    onEdit={handleEditTag}
                    onDelete={handleDeleteTag}
                  />
                )}
              </For>
            </div>
          </DragDropProvider>
        </Show>
      </Suspense>
    </PageLayout>
  );
}
