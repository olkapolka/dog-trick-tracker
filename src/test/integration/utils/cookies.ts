export interface CookieOptions {
  path?: string;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "strict" | "lax" | "none";
  maxAge?: number;
}

interface CookieRecord {
  value: string;
  options?: CookieOptions;
}

export class MemoryCookies {
  private readonly store = new Map<string, CookieRecord>();

  constructor(seed: Record<string, string> = {}) {
    for (const [name, value] of Object.entries(seed)) {
      this.store.set(name, { value });
    }
  }

  get(name: string): { value: string } | undefined {
    const cookie = this.store.get(name);
    return cookie ? { value: cookie.value } : undefined;
  }

  set(name: string, value: string, options?: CookieOptions): void {
    this.store.set(name, { value, options });
  }

  delete(name: string): void {
    this.store.delete(name);
  }

  toHeaderValue(): string {
    return Array.from(this.store.entries())
      .map(([name, cookie]) => `${name}=${cookie.value}`)
      .join("; ");
  }

  toObject(): Record<string, string> {
    return Array.from(this.store.entries()).reduce<Record<string, string>>((acc, [name, cookie]) => {
      acc[name] = cookie.value;
      return acc;
    }, {});
  }
}
