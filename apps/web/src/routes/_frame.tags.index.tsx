import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Tag } from '@repo/domain/client';
import { createFileRoute } from '@tanstack/react-router';
import { EllipsisVertical, GripVertical, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
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

function SortableTagItem({
  tag,
  onEdit,
  onDelete,
}: {
  tag: Tag;
  onEdit: (tag: Tag) => void;
  onDelete: (tag: Tag) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tag.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border-base-300 bg-base-100 flex items-center gap-2 rounded-lg border px-3 py-3 shadow-sm"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-base-content/50 hover:text-base-content/80 shrink-0 cursor-grab touch-none p-1 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical size={20} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <ColorIndicator className={getTagDotColor(tag.color)} />
          <span className="truncate font-medium">{tag.name}</span>
        </div>
        <div className="text-base-content-gray mt-1 text-xs">
          Created <TimeAgo date={tag.createdAt} />
        </div>
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        <Dropdown
          end
          btnClasses="btn-circle btn-ghost btn-sm"
          btnContent={<EllipsisVertical size={16} />}
        >
          <li>
            <button onClick={() => onEdit(tag)}>Edit</button>
          </li>
          <li>
            <button className="text-error" onClick={() => onDelete(tag)}>
              Delete
            </button>
          </li>
        </Dropdown>
      </div>
    </div>
  );
}

function TagsComponent() {
  const tags = useTags();

  const tagModalRef = useRef<ModalController>(null!);
  const deleteModalRef = useRef<ModalController>(null!);

  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleEditTag = (tag: Tag) => {
    setEditingTag(tag);
    tagModalRef.current.open();
  };

  const handleCreateTag = () => {
    setEditingTag(null);
    tagModalRef.current.open();
  };

  const handleDeleteTag = (tag: Tag) => {
    setTagToDelete(tag);
    deleteModalRef.current.open();
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tags.findIndex((t) => t.id === active.id);
    const newIndex = tags.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(tags, oldIndex, newIndex);
    for (let i = 0; i < reordered.length; i++) {
      const tag = reordered[i];
      if (tag && tag.order !== i) {
        tagsCollection.update(tag.id, (draft) => {
          draft.order = i;
        });
      }
    }
  };

  if (!tags) return <CenterLoader />;

  return (
    <PageLayout
      title="Manage Tags"
      headerActions={
        <button className="btn btn-primary btn-sm" onClick={handleCreateTag}>
          <Plus size={20} />
          <span className="hidden sm:inline">Create Tag</span>
        </button>
      }
    >
      <div className="mb-6">
        <p className="text-base-content-gray">Organize your feeds with custom tags and colors</p>
      </div>

      <TagModal
        controller={(c) => {
          tagModalRef.current = c;
        }}
        editTag={editingTag}
        onEditComplete={() => setEditingTag(null)}
      />

      <DeleteTagModal
        controller={(c) => {
          deleteModalRef.current = c;
        }}
        tag={tagToDelete}
        onDeleteComplete={() => setTagToDelete(null)}
        onClose={() => setTagToDelete(null)}
      />

      {tags.length === 0 ? (
        <div className="py-16 text-center">
          <div className="mb-8 flex justify-center">
            <TagsIllustration />
          </div>

          <h2 className="mb-4 text-3xl font-bold">No Tags Yet</h2>
          <p className="text-base-content-gray mx-auto mb-8 max-w-md">
            Create tags to organize and categorize your feeds. Tags help you quickly find and filter
            related content.
          </p>

          <button className="btn btn-primary btn-lg" onClick={() => tagModalRef.current.open()}>
            <Plus size={20} className="mr-2" />
            Create Your First Tag
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={tags.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {tags.map((tag) => (
                <SortableTagItem
                  key={tag.id}
                  tag={tag}
                  onEdit={handleEditTag}
                  onDelete={handleDeleteTag}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </PageLayout>
  );
}
