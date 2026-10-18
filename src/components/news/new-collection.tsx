"use client";

import { FolderPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { createCollectionAction, deleteCollectionAction } from "@/lib/actions/reader";

export function NewCollection() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const result = await createCollectionAction({ name: String(new FormData(event.currentTarget).get("name") ?? "") });
    setBusy(false);
    if (!result.ok) {
      setError(result.fieldErrors?.name ?? result.message);
      return;
    }
    setOpen(false);
    setError(undefined);
    toast.success(`Collection “${result.data.name}” made.`);
    router.refresh();
  }
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <FolderPlus className="size-4" aria-hidden /> New collection
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="New collection" description="Group saved stories however you like: a trip, a project, a topic to come back to.">
        <form onSubmit={onSubmit} className="space-y-4">
          <TextField label="Name" name="name" maxLength={80} required error={error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Make collection
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function DeleteCollection({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        const result = await deleteCollectionAction({ collectionId: id });
        setBusy(false);
        if (!result.ok) return void toast.error(result.message);
        toast.success(`“${name}” deleted. The stories in it are still saved.`);
        router.push("/app/saved");
        router.refresh();
      }}
    >
      Delete this collection
    </Button>
  );
}
