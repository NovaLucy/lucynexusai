// Local biometric storage — face embeddings + voice passphrase.
// Everything is encrypted with AES-GCM using a key derived from a PIN.
// Nothing leaves the device.

import * as faceapi from "face-api.js";

const STORAGE_KEY = "apn:auth:v1";
const MODELS_URL = "https://justadudewhohacks.github.io/face-api.js/models";

let modelsLoaded = false;
export async function loadFaceModels() {
  if (modelsLoaded) return;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
  ]);
  modelsLoaded = true;
}

export async function captureFaceEmbedding(video: HTMLVideoElement): Promise<Float32Array | null> {
  await loadFaceModels();
  const det = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return det?.descriptor ?? null;
}

export function cosineSim(a: Float32Array | number[], b: Float32Array | number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

// Euclidean distance — face-api convention: <0.6 ≈ same face
export function euclidean(a: Float32Array | number[], b: Float32Array | number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

// ---------- Crypto ----------

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw", enc.encode(pin), "PBKDF2", false, ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 150_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

interface StoredEnvelope {
  saltB64: string;
  ivB64: string;
  cipherB64: string;
  // public, unencrypted: lets us know enrollment exists without the PIN
  enrolled: true;
  createdAt: number;
}

interface EnrolledData {
  faceEmbeddings: number[][]; // 3 captures
  voicePassphrase: string; // normalized text
  pin: string;
}

const b64 = {
  enc: (buf: ArrayBuffer | Uint8Array) => {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  },
  dec: (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
};

export function isEnrolled(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const obj = JSON.parse(raw) as StoredEnvelope;
    return obj?.enrolled === true;
  } catch {
    return false;
  }
}

export async function enroll(data: EnrolledData): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(data.pin, salt);
  const payload = JSON.stringify({
    faceEmbeddings: data.faceEmbeddings,
    voicePassphrase: data.voicePassphrase,
  });
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(payload),
  );
  const env: StoredEnvelope = {
    saltB64: b64.enc(salt),
    ivB64: b64.enc(iv),
    cipherB64: b64.enc(cipher),
    enrolled: true,
    createdAt: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(env));
}

export async function loadEnrollment(pin: string): Promise<{
  faceEmbeddings: number[][];
  voicePassphrase: string;
} | null> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const env = JSON.parse(raw) as StoredEnvelope;
    const key = await deriveKey(pin, b64.dec(env.saltB64));
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64.dec(env.ivB64) as BufferSource },
      key,
      b64.dec(env.cipherB64) as BufferSource,
    );
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    return null;
  }
}

export function resetEnrollment() {
  localStorage.removeItem(STORAGE_KEY);
}

export function normalizePassphrase(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Levenshtein-based similarity for passphrase tolerance
export function passphraseMatch(spoken: string, enrolled: string): number {
  const a = normalizePassphrase(spoken);
  const b = normalizePassphrase(enrolled);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
  return 1 - dp[m][n] / Math.max(m, n);
}
