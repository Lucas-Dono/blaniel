/**
 * Push Notification Client Utilities
 * Client-side functions for managing push notification subscriptions
 */

"use client";

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Get current notification permission state
 */
export function getNotificationPermission(): NotificationPermission {
  if (!isPushSupported()) {
    return "denied";
  }
  return Notification.permission;
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    throw new Error("Push notifications not supported");
  }

  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Register service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers not supported");
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

    console.log("[Push] Service worker registered:", registration.scope);

    // Wait for service worker to be active
    if (registration.installing) {
      await new Promise<void>((resolve) => {
        registration.installing!.addEventListener("statechange", (e) => {
          const sw = e.target as ServiceWorker;
          if (sw.state === "activated") {
            resolve();
          }
        });
      });
    }

    return registration;
  } catch (error) {
    console.error("[Push] Service worker registration failed:", error);
    throw error;
  }
}

/**
 * Get VAPID public key from server
 */
async function getVAPIDPublicKey(): Promise<string> {
  try {
    const response = await fetch("/api/notifications/vapid");
    const data = await response.json();

    if (!data.publicKey) {
      throw new Error("VAPID public key not available");
    }

    return data.publicKey;
  } catch (error) {
    console.error("[Push] Error fetching VAPID key:", error);
    throw error;
  }
}

/**
 * Convert base64 string to Uint8Array (for VAPID key)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(): Promise<PushSubscription> {
  try {
    // Check support
    if (!isPushSupported()) {
      throw new Error("Push notifications not supported");
    }

    // Request permission
    const permission = await requestNotificationPermission();
    if (permission !== "granted") {
      throw new Error("Notification permission denied");
    }

    // Register service worker
    const registration = await registerServiceWorker();

    // Get VAPID public key
    const vapidPublicKey = await getVAPIDPublicKey();
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey) as BufferSource;

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    console.log("[Push] Push subscription created:", subscription);

    // Send subscription to server
    const response = await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });

    if (!response.ok) {
      throw new Error("Failed to save subscription");
    }

    console.log("[Push] Subscription saved to server");
    return subscription;
  } catch (error) {
    console.error("[Push] Error subscribing to push notifications:", error);
    throw error;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      console.log("[Push] Push subscription removed");
    }

    // Remove from server
    await fetch("/api/notifications/subscribe", {
      method: "DELETE",
    });

    console.log("[Push] Subscription removed from server");
  } catch (error) {
    console.error("[Push] Error unsubscribing from push notifications:", error);
    throw error;
  }
}

/**
 * Check if user is currently subscribed
 */
export async function isPushSubscribed(): Promise<boolean> {
  try {
    if (!isPushSupported()) {
      return false;
    }

    if (getNotificationPermission() !== "granted") {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    return subscription !== null;
  } catch (error) {
    console.error("[Push] Error checking subscription status:", error);
    return false;
  }
}

/**
 * Get current push subscription
 */
export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  try {
    if (!isPushSupported()) {
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    return subscription;
  } catch (error) {
    console.error("[Push] Error getting subscription:", error);
    return null;
  }
}

/**
 * Show a local notification (for testing)
 */
export async function showLocalNotification(
  title: string,
  options?: NotificationOptions
): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("Notifications not supported");
  }

  if (getNotificationPermission() !== "granted") {
    throw new Error("Notification permission not granted");
  }

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(title, {
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    ...options,
  });
}
