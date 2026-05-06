// Camera — let the user send a photo to APN ("regarde ça").
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

const isNative = Capacitor.isNativePlatform();
export const cameraAvailable = isNative;

export async function pickPhoto(): Promise<string | null> {
  if (!isNative) return null;
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
    return photo.dataUrl ?? null;
  } catch {
    return null;
  }
}
