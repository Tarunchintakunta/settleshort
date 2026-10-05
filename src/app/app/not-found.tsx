import { ArrowLeftIcon, MagnifyingGlassIcon } from "@phosphor-icons/react/ssr";
import { ButtonLink, Empty } from "@/components/ui";

export default function AppNotFound() {
  return (
    <Empty
      icon={<MagnifyingGlassIcon className="size-5" aria-hidden />}
      title="Not found or you don't have access"
      body="It may have been deleted, or it belongs to a workspace you're not signed into."
      action={
        <ButtonLink href="/app">
          <ArrowLeftIcon className="size-4" aria-hidden /> Back to overview
        </ButtonLink>
      }
    />
  );
}
