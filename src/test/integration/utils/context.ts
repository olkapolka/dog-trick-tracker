import { MemoryCookies } from "./cookies";

export interface IntegrationContext {
  request: Request;
  url: URL;
  cookies: MemoryCookies;
  locals: Record<string, unknown>;
  redirect: (path: string, status?: number) => Response;
}

export type IntegrationMiddleware = (
  context: IntegrationContext,
  next: () => Response | Promise<Response>,
) => Response | Promise<Response>;

interface CreateContextOptions {
  method?: string;
  baseUrl?: string;
  body?: string;
  headers?: HeadersInit;
  cookies?: Record<string, string>;
}

export function createRequest(pathname: string, options: CreateContextOptions = {}): Request {
  const method = options.method ?? "GET";
  const baseUrl = options.baseUrl ?? "http://127.0.0.1:4321";
  const headers = new Headers(options.headers);

  if (options.cookies) {
    const cookieHeader = new MemoryCookies(options.cookies).toHeaderValue();
    if (cookieHeader) {
      headers.set("Cookie", cookieHeader);
    }
  }

  const init: RequestInit = { method, headers };
  if (options.body) {
    init.body = options.body;
  }

  return new Request(new URL(pathname, baseUrl), init);
}

export function createIntegrationContext(pathname: string, options: CreateContextOptions = {}): IntegrationContext {
  const request = createRequest(pathname, options);
  const cookies = new MemoryCookies(options.cookies);

  return {
    request,
    url: new URL(request.url),
    cookies,
    locals: {},
    redirect(path: string, status = 302) {
      return new Response(null, {
        status,
        headers: {
          Location: path,
        },
      });
    },
  };
}

export async function runMiddleware(
  middleware: IntegrationMiddleware,
  context: IntegrationContext,
  next: () => Response | Promise<Response> = () => new Response("ok", { status: 200 }),
): Promise<Response> {
  return Promise.resolve(middleware(context, next));
}
