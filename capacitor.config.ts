import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.63a8e0d86a444b37b158eb37c73454e2",
  appName: "APN",
  webDir: "dist",
  bundledWebRuntime: false,
  server: {
    url: "https://63a8e0d8-6a44-4b37-b158-eb37c73454e2.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#03040aff",
  },
  android: {
    backgroundColor: "#03040aff",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#03040a",
      showSpinner: false,
      androidSplashResourceName: "splash",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#03040a",
      overlaysWebView: true,
    },
    Keyboard: {
      resize: "native",
      style: "DARK",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
