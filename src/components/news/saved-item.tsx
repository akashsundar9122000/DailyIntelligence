"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { Check, FolderPlus, NotebookPen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { setInCollectionAction, toggleBookmarkAction, updateBookmarkAction } from "@/lib/actions/reader";

const item = "flex h-10 cursor-pointer items-center gap-2.5 px-3 text-sm text-text-primary outline-none data-[highlighted]:bg-surface-hover coarse:h-11";

/** What can be done to one saved story: read or unread, a private note, collections, remove. */
export function SavedItemControls({
  bookmarkId,
  storyId,
  read,
  note,
  inCollections,
  collections,
}: {
  bookmarkId: string;
  storyId: string;
  read: boolean;
  note: string | null;
  inCollections: string[];
  collections: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  function run(action: () => Promise<{ ok: boolean; message?: string }>, done: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }
      toast.success(done);
      router.refresh();
    });
  }

  function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = String(new FormData(event.currentTarget).get("note") ?? "");
    setEditing(false);
    run(() => updateBookmarkAction({ bookmarkId, note: text }), text.trim() ? "Note saved." : "Note removed.");
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => updateBookmarkAction({ bookmarkId, read: !read }), read ? "Marked as unread." : "Marked as read.")}>
        <Check className="size-4" aria-hidden /> {read ? "Mark unread" : "Mark read"}
      </Button>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => setEditing(true)}>
        <NotebookPen className="size-4" aria-hidden /> {note ? "Edit note" : "Add note"}
      </Button>
      {collections.length ? (
        <Dropdown.Root>
          <Dropdown.Trigger asChild>
            <Button variant="ghost" size="sm" disabled={pending}>
              <FolderPlus className="size-4" aria-hidden /> Collections
            </Button>
          </Dropdown.Trigger>
          <Dropdown.Portal>
            <Dropdown.Content align="start" sideOffset={6} collisionPadding={12} className="z-[var(--z-popover)] w-60 border border-border-strong bg-surface-raised py-1 shadow-lg">
              {collections.map((collection) => {
                const inside = inCollections.includes(collection.id);
                return (
                  <Dropdown.CheckboxItem
                    key={collection.id}
                    className={item}
                    checked={inside}
                    onCheckedChange={(next) =>
                      run(() => setInCollectionAction({ bookmarkId, collectionId: collection.id, inCollection: next === true }), next === true ? `Added to ${collection.name}.` : `Taken out of ${collection.name}.`)
                    }
                  >
                    <span className="flex size-4 items-center justify-center border border-current">{inside ? <Check className="size-3" aria-hidden /> : null}</span>
                    {collection.name}
                  </Dropdown.CheckboxItem>
                );
              })}
            </Dropdown.Content>
          </Dropdown.Portal>
        </Dropdown.Root>
      ) : null}
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => toggleBookmarkAction({ storyId }), "Removed from Saved.")}>
        Remove
      </Button>
      <Dialog open={editing} onOpenChange={setEditing} title="Private note" description="Only you can see this. It is never shown to anyone else or sent to a model.">
        <form onSubmit={saveNote} className="space-y-4">
          <TextField label="Note" name="note" defaultValue={note ?? ""} maxLength={2000} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit">Save note</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
