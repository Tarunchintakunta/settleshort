// Runs once per server start: refuse to boot with a broken env.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { validateEnv } = await import("./lib/env");
  validateEnv();
}
