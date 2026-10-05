import { ArrowLeftIcon, TrayIcon } from "@phosphor-icons/react/ssr";
import { ButtonLink, Empty } from "@/components/ui";

// Same answer whether the claim doesn't exist or lives in another workspace: never confirm it exists.
export default function ClaimNotFound() {
  return (
    <Empty
      icon={<TrayIcon className="size-5" aria-hidden />}
      title="Claim not found or you don't have access"
      body="It may have been deleted, or it belongs to a workspace you're not signed into. Switch workspace or ask the person who shared the link."
      action={
        <ButtonLink href="/app/claims">
          <ArrowLeftIcon className="size-4" aria-hidden /> Back to claims
        </ButtonLink>
      }
    />
  );
}
