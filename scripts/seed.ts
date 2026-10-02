import { createDemoWorkspace } from "../src/lib/seed";

createDemoWorkspace().then((r) => {
  console.log("Seeded Acme Labs demo workspace", r);
  process.exit(0);
});
