import { randomUUID } from "node:crypto";
import { route } from "@/lib/api";
import { presignUpload } from "@/lib/intake";

// Step 1 of a new receipt: { mime, size } -> presigned PUT for a fresh claim id.
export const POST = route(async (req, ctx) => presignUpload(ctx.workspace.id, randomUUID(), await req.json().catch(() => ({}))));
