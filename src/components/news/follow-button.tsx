"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { Ban, Check, ChevronDown, Plus, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { setInterestAction } from "@/lib/actions/reader";
import type { InterestKind, InterestStance } from "@/lib/reader-vocab";

const item = "flex h-10 cursor-pointer items-center gap-2.5 px-3 text-sm text-text-primary outline-none data-[highlighted]:bg-surface-hover coarse:h-11";

/**
 * Follow a section, place, person or source, or mute or block it, from where
 * it appears. One control with the current stance on its face, so the reader
 * always sees what they chose; the choice is listed in Settings with one
 * button to undo.
 */
export function FollowButton({ kind, value, label, stance: initial }: { kind: InterestKind; value: string; label: string; stance: InterestStance | null }) {
  const router = useRouter();
  const [stance, setStance] = useState(initial);
  const [pending, startTransition] = useTransition();

  function choose(next: InterestStance) {
    const previous = stance;
    setStance(next);
    startTransition(async () => {
      const result = await setInterestAction({ kind, value, label, stance: next });
      if (!result.ok) {
        setStance(previous);
        toast.error(result.message);
        return;
      }
      toast.success({ follow: `Following ${label}.`, mute: `${label} is muted: shown lower, never hidden.`, block: `${label} is blocked: removed from your feed.` }[next]);
      router.refresh();
    });
  }

  const face = stance === "follow" ? "Following" : stance === "mute" ? "Muted" : stance === "block" ? "Blocked" : "Follow";
  return (
    <div className="inline-flex">
      <Button variant={stance === "follow" ? "secondary" : "primary"} onClick={() => choose("follow")} disabled={pending || stance === "follow"} aria-pressed={stance === "follow"}>
        {stance === "follow" ? <Check className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
        {face}
      </Button>
      <Dropdown.Root>
        <Dropdown.Trigger asChild>
          <Button variant="secondary" size="icon" aria-label={`More choices for ${label}`} className="-ml-px">
            <ChevronDown className="size-4" aria-hidden />
          </Button>
        </Dropdown.Trigger>
        <Dropdown.Portal>
          <Dropdown.Content align="end" sideOffset={6} collisionPadding={12} className="z-[var(--z-popover)] w-60 border border-border-strong bg-surface-raised py-1 shadow-lg">
            <Dropdown.Item className={item} onSelect={() => choose("follow")}>
              <Plus className="size-4" aria-hidden /> Follow: more of this
            </Dropdown.Item>
            <Dropdown.Item className={item} onSelect={() => choose("mute")}>
              <VolumeX className="size-4" aria-hidden /> Mute: show it lower
            </Dropdown.Item>
            <Dropdown.Item className={item} onSelect={() => choose("block")}>
              <Ban className="size-4" aria-hidden /> Block: never show it
            </Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>
    </div>
  );
}
