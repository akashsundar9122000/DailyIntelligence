"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { Bookmark, BookmarkCheck, ExternalLink, EyeOff, Flag, MoreHorizontal, ThumbsDown, ThumbsUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/dialog";
import { SelectField, TextField } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { feedbackAction, reportAction, toggleBookmarkAction } from "@/lib/actions/reader";
import type { ReportReason } from "@/lib/reader-vocab";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "misleading", label: "Misleading or false" },
  { value: "misattributed", label: "Wrong source or publisher" },
  { value: "duplicate", label: "Duplicate of another story" },
  { value: "wrong_category", label: "In the wrong section" },
  { value: "harmful", label: "Harmful or abusive" },
  { value: "rights", label: "A rights or copyright problem" },
  { value: "other", label: "Something else" },
];

const item = "flex h-10 cursor-pointer items-center gap-2.5 px-3 text-sm text-text-primary outline-none data-[highlighted]:bg-surface-hover coarse:h-11";

export function ReportDialog({ storyId, open, onOpenChange }: { storyId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    const result = await reportAction({ storyId, reason: String(data.get("reason")) as ReportReason, detail: String(data.get("detail") ?? "") });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    onOpenChange(false);
    toast.success("Thank you. Your report went to the editors.");
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Report this story" description="Tell us what is wrong. Reports are read by a person; nothing is removed automatically.">
      <form onSubmit={onSubmit} className="space-y-4">
        <SelectField label="What is wrong" name="reason" defaultValue="misleading" options={REASONS} />
        <TextField label="Anything we should know (optional)" name="detail" maxLength={2000} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Send report
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * Save, open the original, and tell the paper "more", "less" or "not this".
 * The save is optimistic -- it flips at once and flips back if the server
 * refuses -- because a bookmark that waits for a round trip feels broken, and
 * one that silently fails is worse.
 */
export function StoryActions({ storyId, saved: initiallySaved, url, className }: { storyId: string; saved: boolean; url: string; className?: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initiallySaved);
  const [reporting, setReporting] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggleSave() {
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      const result = await toggleBookmarkAction({ storyId });
      if (!result.ok) {
        setSaved(!next);
        toast.error(result.message);
        return;
      }
      setSaved(result.data.saved);
      toast.success(result.data.saved ? "Saved." : "Removed from Saved.");
    });
  }

  function feedback(kind: "more" | "less" | "hide") {
    startTransition(async () => {
      const result = await feedbackAction({ storyId, kind });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const words: Record<typeof kind, [string, string]> = {
        more: ["You'll see more like this.", "Back to normal for stories like this."],
        less: ["You'll see less like this.", "Back to normal for stories like this."],
        hide: ["Hidden from your feed.", "Shown in your feed again."],
      };
      toast.success(words[kind][result.data.active ? 0 : 1]);
      router.refresh();
    });
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button variant="ghost" size="sm" onClick={toggleSave} aria-pressed={saved} disabled={pending} aria-label={saved ? "Remove from Saved" : "Save this story"} title={saved ? "Saved" : "Save"}>
        {saved ? <BookmarkCheck className="size-4" aria-hidden /> : <Bookmark className="size-4" aria-hidden />}
        <span className="hidden sm:inline">{saved ? "Saved" : "Save"}</span>
      </Button>
      <Button variant="ghost" size="sm" asChild>
        <a href={url} target="_blank" rel="noopener noreferrer" title="Open the original">
          <ExternalLink className="size-4" aria-hidden />
          <span className="hidden sm:inline">Original</span>
          <span className="sr-only">(opens the publisher&rsquo;s page in a new tab)</span>
        </a>
      </Button>
      <Dropdown.Root>
        <Dropdown.Trigger asChild>
          <Button variant="ghost" size="icon" aria-label="More about this story">
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </Dropdown.Trigger>
        <Dropdown.Portal>
          <Dropdown.Content align="end" sideOffset={6} collisionPadding={12} className="z-[var(--z-popover)] w-56 border border-border-strong bg-surface-raised py-1 shadow-lg">
            <Dropdown.Item className={item} onSelect={() => feedback("more")}>
              <ThumbsUp className="size-4" aria-hidden /> More like this
            </Dropdown.Item>
            <Dropdown.Item className={item} onSelect={() => feedback("less")}>
              <ThumbsDown className="size-4" aria-hidden /> Less like this
            </Dropdown.Item>
            <Dropdown.Item className={item} onSelect={() => feedback("hide")}>
              <EyeOff className="size-4" aria-hidden /> Hide this story
            </Dropdown.Item>
            <Dropdown.Separator className="my-1 h-px bg-border" />
            <Dropdown.Item className={item} onSelect={() => setReporting(true)}>
              <Flag className="size-4" aria-hidden /> Report a problem
            </Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>
      <ReportDialog storyId={storyId} open={reporting} onOpenChange={setReporting} />
    </div>
  );
}
