import { Footer } from "@/components/marketing/Footer";

export default function HomeLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="light-site flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[110] focus:rounded-[8px] focus:bg-panel focus:px-4 focus:py-2 focus:shadow-pop">
        Skip to content
      </a>
      {children}
      <Footer />
    </div>
  );
}
