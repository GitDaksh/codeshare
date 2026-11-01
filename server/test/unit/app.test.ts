import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { allowedOriginsFrom, createApp } from "../../src/app";

describe("allowed origins", () => {
  it("splits CLIENT_URL on commas, trims, and drops trailing slashes", () => {
    expect(allowedOriginsFrom(" https://codeshare.tech/, https://www.codeshare.tech ,,https://old.vercel.app//")).toEqual([
      "https://codeshare.tech",
      "https://www.codeshare.tech",
      "https://old.vercel.app",
    ]);
  });

  it("is empty when nothing is set", () => {
    expect(allowedOriginsFrom(undefined)).toEqual([]);
    expect(allowedOriginsFrom("")).toEqual([]);
  });
});

// No database here: these run without one.
describe("the app", () => {
  const { app, io } = createApp({ allowedOrigins: ["https://codeshare.tech"], logRequests: false });
  afterAll(() => io.close());

  it("reports a missing database on /health (503), so an uptime monitor raises the alarm", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: "degraded", database: "down" });
    expect(typeof res.body.uptimeSeconds).toBe("number");
  });

  it("only allows the site's own origins (CORS)", async () => {
    const ours = await request(app).get("/").set("Origin", "https://codeshare.tech");
    expect(ours.headers["access-control-allow-origin"]).toBe("https://codeshare.tech");
    const theirs = await request(app).get("/").set("Origin", "https://evil.example");
    expect(theirs.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("sets security headers", async () => {
    const res = await request(app).get("/");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
