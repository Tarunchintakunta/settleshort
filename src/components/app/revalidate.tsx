"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Back/forward and tab switches show fresh claim and batch state instead of the cached page. */
export function Revalidate() {
  const router = useRouter();
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => e.persisted && router.refresh();
    const onVisible = () => document.visibilityState === "visible" && router.refresh();
    window.addEventListener("pageshow", onShow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pageshow", onShow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);
  return null;
}
