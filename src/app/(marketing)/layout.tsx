import { Footer } from "@/components/marketing/Footer";
import { Nav } from "@/components/marketing/Nav";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[8px] focus:bg-panel focus:px-4 focus:py-2 focus:shadow-pop">
        Skip to content
      </a>
      <Nav />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
