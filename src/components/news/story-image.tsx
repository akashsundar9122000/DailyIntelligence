import Image from "next/image";

import { cn } from "@/components/ui/cn";
import type { StoryImage as Picture } from "@/lib/media/story-image";

import { CoverArt } from "./cover-art";
import { PlaceMap } from "./place-map";

/*
 * Class names written out in full: Tailwind generates only what it can read.
 * hero 16:9 (the story page), card 16:10 (lead and standard cards), thumb 1:1
 * (rows and the sidebar).
 */
const FRAMES = {
  hero: "aspect-video rounded-xl",
  card: "aspect-[16/10] rounded-lg",
  thumb: "aspect-square size-16 shrink-0 rounded-md sm:size-20",
} as const;

const SIZES = { hero: "(min-width: 1024px) 60rem, 100vw", card: "(min-width: 1024px) 28rem, 100vw", thumb: "5rem" } as const;

/**
 * A story's picture in its frame, with what it is said beside it.
 *
 * The frame has a fixed shape, so nothing moves when it arrives. Every kind is
 * labelled by what it IS -- Photo, Video, AI illustration, Map, Illustration
 * -- and credited; an AI illustration carries its label on the picture itself,
 * wherever it appears, even as a thumbnail.
 */
export function StoryPicture({ image, variant, priority, className }: { image: Picture; variant: keyof typeof FRAMES; priority?: boolean; className?: string }) {
  const art = "absolute inset-0 size-full";
  return (
    <figure className={cn("story-picture group/picture relative m-0", variant === "thumb" ? "" : "w-full", className)}>
      <div className={cn("relative overflow-hidden border border-border bg-surface-sunken", FRAMES[variant])}>
        <div className="story-picture-zoom absolute inset-0">
          {image.kind === "art" ? (
            <CoverArt seed={image.seed} section={image.section} className={art} />
          ) : image.kind === "map" ? (
            <PlaceMap focus={image.focus} pins={image.pins} detail={variant === "hero" ? "fine" : variant === "thumb" ? "thumb" : "card"} aspect={variant === "thumb" ? 1 : variant === "hero" ? 16 / 9 : 1.6} className={art} />
          ) : (
            <Image src={image.src} alt={image.alt} fill sizes={SIZES[variant]} priority={priority} className="object-cover" />
          )}
        </div>
        {image.kind === "ai" ? (
          <span className="absolute left-2 top-2 rounded-sm bg-surface px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-[0.08em] text-text-primary">AI illustration</span>
        ) : null}
      </div>
      {variant === "thumb" ? null : (
        <figcaption className={cn("mt-1.5 text-text-tertiary", variant === "hero" ? "text-xs" : "text-[0.6875rem]")}>
          {image.credit}
        </figcaption>
      )}
    </figure>
  );
}
