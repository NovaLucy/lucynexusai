// Camera — partager une photo avec APN ("regarde ça").
// Sur natif : Capacitor Camera. Sur web : <input type="file" capture>.
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

const isNative = Capacitor.isNativePlatform();
export const cameraAvailable = true; // dispo partout (web + natif)

const MAX_DIM = 1024;
const JPEG_Q = 0.82;

async function downscaleDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      const scale = Math.min(1, MAX_DIM / Math.max(width, height));
      const w = Math.round(width * scale);
      const h = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", JPEG_Q));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export async function pickPhotoWeb(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    // Préfère caméra arrière sur mobile, mais permet la galerie
    input.setAttribute("capture", "environment");
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const raw = await fileToDataUrl(file);
      const small = await downscaleDataUrl(raw);
      resolve(small);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function pickPhoto(): Promise<string | null> {
  if (!isNative) return pickPhotoWeb();
  try {
    const photo = await Camera.getPhoto({
      quality: 70,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt,
      promptLabelHeader: "Photo",
      promptLabelPhoto: "Bibliothèque",
      promptLabelPicture: "Prendre",
    });
    if (!photo.dataUrl) return null;
    return await downscaleDataUrl(photo.dataUrl);
  } catch {
    return null;
  }
}
