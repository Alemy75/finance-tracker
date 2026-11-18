export class HttpError extends Error {
  constructor(message: string, readonly status: number, readonly body: unknown) {
    super(message);
    this.name = "HttpError";
  }
}

export type HttpClient = ReturnType<typeof createHttpClient>;

/** Same-origin fetch wrapper for the Worker API; non-2xx responses reject with `HttpError` carrying the JSON body. */
export function createHttpClient() {
  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...init });
    if (!response.ok) {
      const body = await response.clone().json().catch(() => null) as unknown;
      throw new HttpError(`[httpClient] ${init.method ?? "GET"} ${path}: ${response.status}`, response.status, body);
    }
    return response;
  }

  return {
    request,
    async getJson<T>(path: string, init?: RequestInit): Promise<T> {
      return (await request(path, init)).json() as Promise<T>;
    },
    async postJson<T>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<T | null> {
      const response = await request(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body)
      });
      return response.json().catch(() => null) as Promise<T | null>;
    }
  };
}
