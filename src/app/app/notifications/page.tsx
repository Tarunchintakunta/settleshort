import { and, desc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { BellIcon } from "@phosphor-icons/react/ssr";
import { Button, cx, Empty, PageHeader } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth";
import { db, notifications } from "@/lib/db";

export const metadata = { title: "Notifications" };

async function markAllRead() {
  "use server";
  const ctx = await requirePageCtx();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, ctx.user.id), eq(notifications.workspaceId, ctx.workspace.id), isNull(notifications.readAt)));
  revalidatePath("/app", "layout");
}

export default async function NotificationsPage() {
  const ctx = await requirePageCtx();
  const rows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, ctx.user.id), eq(notifications.workspaceId, ctx.workspace.id)))
    .orderBy(desc(notifications.createdAt))
    .limit(100);
  const unread = rows.some((r) => !r.readAt);

  return (
    <>
      <PageHeader
        title="Notifications"
        sub="Claims to review, approvals, payouts and failures that involve you."
        actions={
          unread ? (
            <form action={markAllRead}>
              <Button variant="secondary">Mark all read</Button>
            </form>
          ) : undefined
        }
      />
      {rows.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-[12px] border border-line shadow-soft">
          {rows.map((n) => (
            <li key={n.id}>
              <Link href={n.href ?? "/app"} className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-sunken">
                <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-accent")} aria-label={n.readAt ? undefined : "Unread"} />
                <div className="min-w-0 flex-1">
                  <p className={cx("text-sm break-words", !n.readAt && "font-medium")}>{n.title}</p>
                  {n.body && <p className="mt-0.5 text-[13px] text-muted">{n.body}</p>}
                </div>
                <time className="shrink-0 text-xs text-muted" dateTime={n.createdAt.toISOString()}>
                  {n.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty icon={<BellIcon className="size-5" aria-hidden />} title="Nothing yet" body="You'll hear here when a claim needs you or money moves." />
      )}
    </>
  );
}
