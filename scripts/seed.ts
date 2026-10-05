import { eq } from "drizzle-orm";
import { db, users } from "../src/lib/db";
import { createDemoWorkspace } from "../src/lib/seed";

// Idempotent: creates the fixed "Northbeam Labs" demo team once, with password logins.
const password = process.env.DEMO_PASSWORD || "settleshort-demo";

async function main() {
  const [existing] = await db.select().from(users).where(eq(users.email, "maya@demo.settleshort.app"));
  if (!existing) await createDemoWorkspace({ password });
  console.log(existing ? "Demo team already seeded." : "Seeded Northbeam Labs demo team.");
  console.log("Logins (password from DEMO_PASSWORD, default settleshort-demo):");
  console.log("  admin   maya@demo.settleshort.app");
  console.log("  member  sam@demo.settleshort.app");
  console.log("  member  rita@demo.settleshort.app");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
