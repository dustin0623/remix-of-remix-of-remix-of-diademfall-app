import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveKeypair, generateSeed, deriveAddress, sign } from "ripple-keypairs";
import { encode, encodeForSigning } from "ripple-binary-codec";
import { buildLoginTx, verifyXrplSignedTx, verifyXamanSignIn, getXamanStatus } from "./action";

const msg = "Sign in\nNonce: 1";

function signedBlob(message: string) {
  const kp = deriveKeypair(generateSeed());
  const address = deriveAddress(kp.publicKey);
  const tx = { ...buildLoginTx(address, message), Fee: "12", Sequence: 1, SigningPubKey: kp.publicKey };
  const TxnSignature = sign(encodeForSigning(tx as never), kp.privateKey);
  return { address, blob: encode({ ...tx, TxnSignature } as never) };
}

const fakeFetch = (body: unknown) => (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch;

describe("xrpl login", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(["opened", "app_opened"])("reports %s as scanned for the matching challenge", async (field) => {
    vi.stubEnv("API_KEY", "k");
    vi.stubEnv("API_SECRET", "s");
    const payload = { meta: { [field]: true }, custom_meta: { blob: { token: "t" } } };
    expect(await getXamanStatus("u", "t", fakeFetch(payload))).toEqual({ status: "scanned" });
    expect(await getXamanStatus("u", "other", fakeFetch(payload))).toEqual({ status: "rejected" });
  });

  it.each([
    { meta: { opened: true, signed: true, expired: true }, response: { account: "rX" }, expected: { status: "signed", account: "rX" } },
    { meta: { app_opened: true, expired: true }, expected: { status: "expired" } },
    { meta: { opened: true, cancelled: true }, expected: { status: "rejected" } },
    { meta: { app_opened: true, resolved: true }, expected: { status: "rejected" } },
  ])("terminal status overrides scanned metadata: $expected.status", async ({ meta, expected, ...payload }) => {
    vi.stubEnv("API_KEY", "k");
    vi.stubEnv("API_SECRET", "s");
    expect(await getXamanStatus("u", "t", fakeFetch({ ...payload, meta, custom_meta: { blob: { token: "t" } } }))).toEqual(expected);
  });

  it("joey signed tx verifies", () => {
    const { address, blob } = signedBlob(msg);
    expect(verifyXrplSignedTx(address, msg, blob)).toBe(true);
    expect(verifyXrplSignedTx(address, msg + "x", blob)).toBe(false);
    expect(verifyXrplSignedTx("rWrong", msg, blob)).toBe(false);
  });

  it("xaman sign-in bound to token", async () => {
    vi.stubEnv("API_KEY", "k");
    vi.stubEnv("API_SECRET", "s");
    const signed = { meta: { signed: true }, response: { account: "rAbc" }, custom_meta: { blob: { token: "t1" } } };
    expect(await verifyXamanSignIn("u", "t1", fakeFetch(signed))).toBe("rAbc");
    expect(await verifyXamanSignIn("u", "t2", fakeFetch(signed))).toBeNull();
    expect(await getXamanStatus("u", "t", fakeFetch({ meta: { expired: true }, custom_meta: { blob: { token: "t" } } }))).toEqual({ status: "expired" });
    expect(await getXamanStatus("u", "t", fakeFetch({ meta: {}, custom_meta: { blob: { token: "t" } } }))).toEqual({ status: "pending" });
    expect(await getXamanStatus("u", "t", fakeFetch({ meta: { signed: true }, response: { account: "rX" }, custom_meta: { blob: { token: "other" } } }))).toEqual({ status: "rejected" });
    vi.unstubAllEnvs();
  });
});
