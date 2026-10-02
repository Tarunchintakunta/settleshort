import Image from "next/image";
import { cx } from "@/components/ui";

/** A real product screenshot (2880x1800) in a quiet frame. `crop` sets aspect + object-position for close-ups. */
export function Shot({
  src,
  alt,
  sizes,
  preload,
  crop,
  className,
}: {
  src: string;
  alt: string;
  sizes: string;
  preload?: boolean;
  crop?: string;
  className?: string;
}) {
  return (
    <figure className={cx("rounded-[12px] border border-line bg-panel p-1.5 shadow-soft", className)}>
      {crop ? (
        <div className={cx("relative overflow-hidden rounded-[8px]", crop)}>
          <Image src={src} alt={alt} fill sizes={sizes} preload={preload} className="object-cover" />
        </div>
      ) : (
        <Image src={src} alt={alt} width={2880} height={1800} sizes={sizes} preload={preload} className="h-auto w-full rounded-[8px]" />
      )}
    </figure>
  );
}
