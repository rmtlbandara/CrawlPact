// External, black-box smoke test against a deployed CrawlPact origin.
// Deliberately HTTP-only (no Cloudflare/D1 API calls) — it's meant to prove
// what a real visitor's browser would actually see, as the last check
// before a deployment is declared successful. Never asserts anything it
// hasn't directly observed in a response.
//
// Run with:
//   node --experimental-strip-types scripts/smoke-test.ts <preview|production> <baseUrl>
type Target = "preview" | "production";

type CheckResult = { name: string; ok: boolean; detail?: string };

const results: CheckResult[] = [];

function record(name: string, ok: boolean, detail?: string): void {
  results.push({ ok, name, detail });
  const icon = ok ? "OK  " : "FAIL";
  console.error(`[${icon}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function get(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { redirect: "manual", ...init });
}

const SECRET_PATTERNS = [/sk_live_/, /pdl_live_/, /whsec_/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/];

function assertNoSecretsInBody(name: string, body: string): void {
  const hit = SECRET_PATTERNS.find((pattern) => pattern.test(body));
  record(`${name}: no secret material in response body`, !hit, hit ? `matched ${hit}` : undefined);
}

async function checkPage(
  label: string,
  url: string,
  expectStatus: number,
  bodyMustContain: string[] = [],
): Promise<string> {
  const response = await get(url);
  record(
    `${label}: HTTP ${expectStatus}`,
    response.status === expectStatus,
    `got ${response.status}`,
  );
  const body = await response.text();
  for (const needle of bodyMustContain) {
    record(`${label}: contains "${needle}"`, body.includes(needle));
  }
  assertNoSecretsInBody(label, body);
  return body;
}

async function checkRedirect(label: string, url: string, expectedLocation: string): Promise<void> {
  const response = await get(url);
  const isRedirect = response.status >= 300 && response.status < 400;
  record(`${label}: is a redirect`, isRedirect, `got ${response.status}`);
  const location = response.headers.get("location");
  record(
    `${label}: redirects to ${expectedLocation}`,
    location === expectedLocation,
    `got ${location}`,
  );
}

async function run(): Promise<void> {
  const target = process.argv[2] as Target | undefined;
  const baseUrl = process.argv[3];
  if (!target || !baseUrl || !(["preview", "production"] as Target[]).includes(target)) {
    console.error("Usage: smoke:<preview|production> <baseUrl>");
    process.exit(1);
  }
  const base = baseUrl.replace(/\/$/, "");

  await checkPage("Home page", `${base}/`, 200);
  await checkPage("Pricing page", `${base}/pricing`, 200);
  await checkPage("robots.txt", `${base}/robots.txt`, 200, ["Sitemap:"]);
  await checkPage("sitemap.xml", `${base}/sitemap.xml`, 200);
  await checkPage("Sign-in / registration entry point", `${base}/sign-in`, 200, [
    "Sign in with passkey",
    "Create account",
  ]);
  await checkPage("/pay (no _ptxn, safe state)", `${base}/pay`, 200, ["Complete your payment"]);
  await checkPage("Known 404", `${base}/this-page-does-not-exist`, 404);

  const statusBody = await checkPage("Status page", `${base}/status`, 200, [
    "Free audit (real scan)",
  ]);
  record(
    "Status page: audit-engine label is honest (disabled)",
    statusBody.includes("Disabled in this environment"),
  );
  if (target === "preview") {
    record(
      "Status page: billing correctly reports not configured in preview",
      statusBody.includes("Not configured in this environment"),
    );
    const homeBody = await checkPage("Home page (env banner)", `${base}/`, 200);
    record(
      "Home page: shows the Preview environment banner",
      homeBody.includes("Preview environment"),
    );
  } else {
    const homeBody = await checkPage("Home page (env banner)", `${base}/`, 200);
    record(
      "Home page: production shows no non-production environment banner",
      !homeBody.includes("environment</div>") &&
        !homeBody.includes("Local Development environment"),
    );
  }

  const home = await get(`${base}/`);
  record(
    "Security headers: X-Content-Type-Options present",
    home.headers.get("x-content-type-options") !== null,
  );
  record(
    "Security headers: Content-Security-Policy present",
    home.headers.get("content-security-policy") !== null,
  );

  const webhookResponse = await get(`${base}/api/billing/webhook`, {
    method: "POST",
    body: JSON.stringify({}),
    headers: { "Content-Type": "application/json" },
  });
  record(
    "Paddle webhook: rejects a request with no valid signature",
    webhookResponse.status === 400 || webhookResponse.status === 401,
    `got ${webhookResponse.status}`,
  );

  if (target === "production") {
    await checkRedirect(
      "http apex -> https apex",
      "http://crawlpact.com/",
      "https://crawlpact.com/",
    );
    await checkRedirect(
      "https www -> https apex",
      "https://www.crawlpact.com/",
      "https://crawlpact.com/",
    );
  }

  const failed = results.filter((r) => !r.ok);
  console.error(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) {
    console.error(`\nFAILED (${failed.length}):`);
    for (const f of failed) console.error(`  - ${f.name}${f.detail ? ` (${f.detail})` : ""}`);
    process.exit(1);
  }
}

run();
