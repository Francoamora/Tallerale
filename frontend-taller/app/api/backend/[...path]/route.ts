import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "ag_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const FALLBACK_BACKEND = "http://127.0.0.1:8000/api";

function backendRoot(): string {
  const value =
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    (process.env.NODE_ENV !== "production" ? FALLBACK_BACKEND : "");

  if (!value) {
    throw new Error("API_BASE_URL no está configurada.");
  }
  return value.replace(/\/$/, "");
}

function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

async function proxyToBackend(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await context.params;
    const backendPath = `/${path.join("/")}${request.nextUrl.pathname.endsWith("/") ? "/" : ""}`;
    const target = `${backendRoot()}${backendPath}${request.nextUrl.search}`;
    const headers = new Headers();
    const contentType = request.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    headers.set("accept", request.headers.get("accept") ?? "application/json");

    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (token) headers.set("authorization", `Token ${token}`);

    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      redirect: "manual",
    });

    const responseContentType = upstream.headers.get("content-type") ?? "";
    const isJson = responseContentType.includes("application/json");
    const isAuthResponse =
      backendPath === "/auth/login/" ||
      backendPath === "/auth/register/" ||
      backendPath === "/auth/rotate-token/";

    if (isJson && isAuthResponse && upstream.ok) {
      const payload = (await upstream.json()) as Record<string, unknown>;
      const newToken = typeof payload.token === "string" ? payload.token : "";
      delete payload.token;
      const response = NextResponse.json(payload, {
        status: upstream.status,
        headers: { "Cache-Control": "no-store" },
      });
      if (newToken) setSessionCookie(response, newToken);
      return response;
    }

    const response = new NextResponse(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: {
        "Content-Type": responseContentType || "application/octet-stream",
        "Cache-Control": "no-store",
      },
    });

    if (upstream.status === 401 || backendPath === "/auth/logout/") {
      clearSessionCookie(response);
    }
    return response;
  } catch (error) {
    console.error("[Backend proxy]", error);
    return NextResponse.json(
      { message: "No se pudo conectar con el servidor." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const GET = proxyToBackend;
export const POST = proxyToBackend;
export const PUT = proxyToBackend;
export const PATCH = proxyToBackend;
export const DELETE = proxyToBackend;
