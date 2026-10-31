/**
 * Where this browser keeps its trusted device key (SSO unlock).
 *
 * The device's X-Wing seed is encrypted with an AES-GCM key that WebCrypto
 * creates as non-extractable, and both are stored in IndexedDB. Scripts on
 * this origin can use the AES key while the page runs, but cannot read it
 * out, so a copy of the seed cannot be carried off by exporting storage
 * through the page. The browser keeps the key material in its profile on
 * disk, without a hardware key: someone with the unlocked computer or a
 * copy of the profile has the device key. Unlocking additionally needs a
 * sign-in at the identity provider. See docs/architecture/sso.md.
 */
import type { TrustedDeviceSecret } from "@passbox/client";

const DB_NAME = "passbox-trusted-device";
const STORE = "devices";

interface StoredDevice {
  accountId: string;
  deviceId: string;
  key: CryptoKey;
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: ArrayBuffer;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "accountId" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, body: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = body(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/** Whether this browser can keep a trusted device key. */
export function canTrustThisBrowser(): boolean {
  return typeof indexedDB !== "undefined" && typeof crypto !== "undefined" && "subtle" in crypto;
}

export async function saveTrustedDevice(secret: TrustedDeviceSecret): Promise<void> {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = new TextEncoder().encode(
    `passbox/v1/web-trusted-device|${secret.accountId}|${secret.deviceId}`,
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData },
    key,
    new TextEncoder().encode(secret.seed),
  );
  const record: StoredDevice = { accountId: secret.accountId, deviceId: secret.deviceId, key, iv, ciphertext };
  await run("readwrite", (store) => store.put(record));
}

export async function loadTrustedDevice(accountId: string): Promise<TrustedDeviceSecret | undefined> {
  if (!canTrustThisBrowser()) return undefined;
  try {
    const record = (await run("readonly", (store) => store.get(accountId))) as StoredDevice | undefined;
    if (!record) return undefined;
    const additionalData = new TextEncoder().encode(
      `passbox/v1/web-trusted-device|${record.accountId}|${record.deviceId}`,
    );
    const seed = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: record.iv, additionalData },
      record.key,
      record.ciphertext,
    );
    return { accountId: record.accountId, deviceId: record.deviceId, seed: new TextDecoder().decode(seed) };
  } catch (error) {
    console.warn("Could not read the trusted device key", error);
    return undefined;
  }
}

export async function forgetTrustedDevice(accountId: string): Promise<void> {
  if (!canTrustThisBrowser()) return;
  await run("readwrite", (store) => store.delete(accountId));
}
