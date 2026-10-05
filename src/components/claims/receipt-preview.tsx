"use client";

import { useRef } from "react";
import { XIcon } from "@phosphor-icons/react";
import { cx } from "@/components/ui";

/**
 * Receipt image with a tap-to-enlarge lightbox. `src` is one of our API routes, which redirect to a
 * short-lived presigned S3 URL, so the image is only ever fetched by a signed-in workspace member.
 */
export function ReceiptPreview({ src, alt, thumb = false }: { src: string; alt: string; thumb?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className={cx("block cursor-zoom-in rounded-[8px]", thumb && "shrink-0")} aria-label={`Enlarge ${alt}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" className={thumb ? "size-16 rounded-[8px] border border-line object-cover" : "max-h-[560px] w-auto rounded-[8px] shadow-pop"} />
      </button>
      <dialog
        ref={dialog}
        aria-label={alt}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-auto max-h-[92dvh] max-w-[94vw] rounded-[12px] bg-transparent p-0 backdrop:bg-[rgb(12_12_14/0.75)]"
      >
        <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="fixed top-3 right-3 flex size-11 items-center justify-center rounded-full bg-panel text-ink shadow-pop">
          <XIcon className="size-5" aria-hidden />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="max-h-[92dvh] max-w-[94vw] rounded-[12px] object-contain" />
      </dialog>
    </>
  );
}
