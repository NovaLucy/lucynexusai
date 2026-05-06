// Local notifications — schedule a gentle "follow-up" from APN.
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const isNative = Capacitor.isNativePlatform();

export async function ensureNotifPerms(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display === "granted") return true;
    const r = await LocalNotifications.requestPermissions();
    return r.display === "granted";
  } catch {
    return false;
  }
}

export async function scheduleAPNFollowup(opts: {
  title: string;
  body: string;
  inMinutes: number;
}) {
  if (!isNative) return false;
  const ok = await ensureNotifPerms();
  if (!ok) return false;
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 1_000_000),
          title: opts.title,
          body: opts.body,
          schedule: { at: new Date(Date.now() + opts.inMinutes * 60_000) },
          sound: undefined,
          smallIcon: "ic_stat_icon_config_sample",
        },
      ],
    });
    return true;
  } catch (e) {
    console.warn("schedule notif failed", e);
    return false;
  }
}

export async function cancelAllAPNNotifs() {
  if (!isNative) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
  } catch {}
}
