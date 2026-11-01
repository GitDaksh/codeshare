import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { limiter, limitRequests } from "../../src/lib/rateLimit";

describe("token bucket limiter", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("allows a burst, refuses the next, then refills over time", () => {
    const limit = limiter(3, 1); // 3 at once, then 1 per second
    expect([limit.take("u"), limit.take("u"), limit.take("u")]).toEqual([true, true, true]);
    expect(limit.take("u")).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(limit.take("u")).toBe(true);
    expect(limit.take("u")).toBe(false);
  });

  it("keeps a separate bucket per key", () => {
    const limit = limiter(1, 1);
    expect(limit.take("a")).toBe(true);
    expect(limit.take("a")).toBe(false);
    expect(limit.take("b")).toBe(true);
  });

  it("never refills past the burst", () => {
    const limit = limiter(2, 10);
    vi.advanceTimersByTime(60_000);
    expect([limit.take("u"), limit.take("u"), limit.take("u")]).toEqual([true, true, false]);
  });
});

describe("limitRequests middleware", () => {
  function fakeResponse() {
    const res = { statusCode: 200, headers: {} as Record<string, string>, body: undefined as unknown };
    return Object.assign(res, {
      setHeader(name: string, value: string) {
        res.headers[name] = value;
      },
      status(code: number) {
        res.statusCode = code;
        return this;
      },
      json(body: unknown) {
        res.body = body;
        return this;
      },
    });
  }

  it("passes requests through until the limit, then answers 429 with Retry-After", () => {
    const middleware = limitRequests(limiter(2, 0.001));
    const req = { headers: {}, __testUserId: "user_rate" } as unknown as Request;
    const next = vi.fn() as unknown as NextFunction;
    const res = fakeResponse();
    middleware(req, res as unknown as Response, next);
    middleware(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(2);
    middleware(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBe("10");
  });
});
