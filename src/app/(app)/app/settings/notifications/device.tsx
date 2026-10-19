"use client";

import { BellOff, BellRing, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { removePushEndpointAction, removePushSubscriptionAction, savePushSubscriptionAction, sendTestNotificationAction } from "@/lib/actions/notifications";

type State = "checking" | "unsupported" | "denied" | "off" | "on";

/** The VAPID public key, base64url, as the browser's subscribe() wants it: bytes. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = `${base64url}${"=".repeat((4 - (base64url.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

const supported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/**
 * Notifications on THIS device. The browser's permission prompt appears only
 * after the reader presses the button -- never on page load -- and turning it
 * off here removes the subscription from the browser and from us.
 */
export function DevicePush({ publicKey }: { publicKey: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!supported()) return "unsupported" as const;
      if (Notification.permission === "denied") return "denied" as const;
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      return subscription ? ("on" as const) : ("off" as const);
    }
    void check().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function turnOn() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
      const json = subscription.toJSON();
      const result = await savePushSubscriptionAction({ endpoint: subscription.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" });
      if (!result.ok) {
        await subscription.unsubscribe();
        toast.error(result.message);
        return;
      }
      setState("on");
      toast.success("Notifications are on for this device.");
      router.refresh();
    } catch {
      toast.error("This browser would not turn notifications on. Check its site settings and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await removePushEndpointAction({ endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setState("off");
      toast.success("Notifications are off for this device.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    const result = await sendTestNotificationAction({});
    setBusy(false);
    if (!result.ok) return void toast.error(result.message);
    if (result.data.sent) toast.success(`Sent to ${result.data.devices} ${result.data.devices === 1 ? "device" : "devices"}. It should appear in a moment.`);
    else toast.error("No device accepted it. Turn notifications off and on again on the device that missed it.");
    router.refresh();
  }

  const message: Record<State, string> = {
    checking: "Checking this browser…",
    unsupported: "This browser cannot receive notifications from websites. On an iPhone or iPad, add the paper to your home screen first.",
    denied: "This browser has blocked notifications from this site. Allow them in the browser's site settings, then come back.",
    off: "Notifications are off on this device.",
    on: "Notifications are on for this device.",
  };

  return (
    <div className="space-y-3 py-4">
      <p className="text-sm text-text-secondary" role="status">
        {message[state]}
      </p>
      <div className="flex flex-wrap gap-2">
        {state === "off" ? (
          <Button onClick={() => void turnOn()} loading={busy}>
            <BellRing className="size-4" aria-hidden /> Turn on for this device
          </Button>
        ) : null}
        {state === "on" ? (
          <>
            <Button variant="secondary" onClick={() => void test()} loading={busy}>
              <Send className="size-4" aria-hidden /> Send a test
            </Button>
            <Button variant="ghost" onClick={() => void turnOff()} disabled={busy}>
              <BellOff className="size-4" aria-hidden /> Turn off for this device
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function RemoveDevice({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={busy}
      aria-label={`Stop notifications to ${label}`}
      onClick={async () => {
        setBusy(true);
        const result = await removePushSubscriptionAction({ id });
        setBusy(false);
        if (!result.ok) return void toast.error(result.message);
        toast.success(`${label} will get no more notifications.`);
        router.refresh();
      }}
    >
      Remove
    </Button>
  );
}
