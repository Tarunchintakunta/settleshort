import { describe, expect, it } from "vitest";
import { validateEnv } from "../src/lib/env";

const DB = { DATABASE_URL: "postgres://u:p@localhost:5432/db" };

describe("env validation", () => {
  it("passes with just a database in development", () => {
    expect(validateEnv({ ...DB, NODE_ENV: "development" }).DATABASE_URL).toBe(DB.DATABASE_URL);
  });
  it("lists every problem without echoing values", () => {
    let msg = "";
    try {
      validateEnv({ NODE_ENV: "production", DATABASE_URL: "mysql://secret-host", PAYPAL_CLIENT_ID: "id-123", AWS_REGION: "us-east-1" });
    } catch (e) {
      msg = (e as Error).message;
    }
    for (const k of ["DATABASE_URL", "SESSION_SECRET", "PAYPAL_CLIENT_SECRET", "S3_BUCKET_NAME"]) expect(msg).toContain(k);
    expect(msg).not.toContain("secret-host");
    expect(msg).not.toContain("id-123");
  });
  it("refuses the live PayPal host and half an SMTP config", () => {
    expect(() => validateEnv({ ...DB, PAYPAL_API_BASE: "https://api-m.paypal.com" })).toThrow(/PAYPAL_API_BASE/);
    expect(() => validateEnv({ ...DB, SMTP_HOST: "smtp.gmail.com" })).toThrow(/SMTP_HOST/);
  });
  it("treats empty strings as unset", () => {
    expect(() => validateEnv({ ...DB, PAYPAL_CLIENT_ID: "", PAYPAL_CLIENT_SECRET: "" })).not.toThrow();
  });
});
