export type RuntimeSmokeResult = { skipped: true; reason: string } | { skipped: false; status: number; ok: boolean };

const DEFAULT_PATH = "/auth/signin";

export async function runRuntimeSmoke(
  baseUrl = process.env.TEST_RUNTIME_BASE_URL,
  path = DEFAULT_PATH,
): Promise<RuntimeSmokeResult> {
  if (!baseUrl) {
    return {
      skipped: true,
      reason: "Set TEST_RUNTIME_BASE_URL to run runtime smoke checks.",
    };
  }

  const response = await fetch(new URL(path, baseUrl));

  return {
    skipped: false,
    status: response.status,
    ok: response.status < 500,
  };
}
