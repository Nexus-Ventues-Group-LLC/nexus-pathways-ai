import type { IncomingHttpHeaders } from "http";
import type { RequestHandler } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

export const CLERK_PROXY_PATH = "/api/__clerk";
const CLERK_FAPI = "https://frontend-api.clerk.dev";

export function getClerkProxyHost(req: { headers: IncomingHttpHeaders }): string | undefined {
  const forwarded = req.headers["x-forwarded-host"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return raw?.split(",")[0]?.trim() || req.headers.host?.trim() || undefined;
}

export function clerkProxyMiddleware(): RequestHandler {
  if (process.env.NODE_ENV !== "production" || !process.env.CLERK_SECRET_KEY) return (_req, _res, next) => next();
  const secretKey = process.env.CLERK_SECRET_KEY;
  return createProxyMiddleware({
    target: CLERK_FAPI, changeOrigin: true, pathRewrite: (path) => path.replace(/^\/api\/__clerk/, ""),
    on: { proxyReq: (proxyReq, req) => {
      const protocol = req.headers["x-forwarded-proto"] || "https";
      proxyReq.setHeader("Clerk-Proxy-Url", `${protocol}://${getClerkProxyHost(req) || ""}${CLERK_PROXY_PATH}`);
      proxyReq.setHeader("Clerk-Secret-Key", secretKey);
    } },
  }) as RequestHandler;
}