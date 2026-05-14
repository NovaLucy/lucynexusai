// Native bridge — only activates when running inside the Capacitor shell.
// Stays inert in the browser/PWA so the web build behaves identically.
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { Keyboard } from "@capacitor/keyboard";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { App } from "@capacitor/app";

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // "ios" | "android" | "web"

export async function initNative() {
  if (!isNative) return;

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch {}

  try {
    await SplashScreen.hide({ fadeOutDuration: 350 });
  } catch {}

  // Lift the input above the keyboard on iOS/Android.
  try {
    Keyboard.addListener("keyboardWillShow", (info) => {
      document.documentElement.style.setProperty("--keyboard-h", `${info.keyboardHeight}px`);
    });
    Keyboard.addListener("keyboardWillHide", () => {
      document.documentElement.style.setProperty("--keyboard-h", "0px");
    });
  } catch {}

  // Hardware back button on Android: do not exit if there's UI to close.
  try {
    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else App.exitApp();
    });
  } catch {}
}

// Lightweight haptic helpers — silent no-op on web.
export async function tapLight() {
  if (!isNative) {
    try { (navigator as any).vibrate?.(10); } catch {}
    return;
  }
  try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
}
export async function tapMedium() {
  if (!isNative) {
    try { (navigator as any).vibrate?.(20); } catch {}
    return;
  }
  try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
}
// Micro-pulse — used to "tick" with the voice (per sentence / accent).
export async function tapMicro() {
  if (!isNative) {
    try { (navigator as any).vibrate?.(6); } catch {}
    return;
  }
  try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
}
