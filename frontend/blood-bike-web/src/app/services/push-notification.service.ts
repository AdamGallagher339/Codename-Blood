import { Injectable, inject } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private swPush = inject(SwPush);
  private http = inject(HttpClient);
  private subscribed = false;

  /** Whether push is supported in this browser/context */
  get isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  }

  /**
   * Subscribe to push notifications.
   * Uses Angular SwPush if the ngsw service worker is active,
   * otherwise falls back to the native Push API.
   */
  async subscribe(): Promise<boolean> {
    if (this.subscribed) return true;

    if (!this.isSupported) {
      console.warn('Push: browser does not support push notifications');
      return false;
    }

    try {
      // Ensure our push service worker is registered
      await this.ensurePushServiceWorker();

      // 1. Get VAPID public key from backend
      const { publicKey } = await firstValueFrom(
        this.http.get<{ publicKey: string }>('/api/push/vapid-key')
      );
      console.log('Push: got VAPID key, SwPush.isEnabled =', this.swPush.isEnabled);

      let subJson: any;

      if (this.swPush.isEnabled) {
        // Angular service worker path
        console.log('Push: subscribing via Angular SwPush');
        const sub = await this.swPush.requestSubscription({
          serverPublicKey: publicKey,
        });
        subJson = sub.toJSON();
      } else {
        // Native fallback — use whatever service worker is registered
        console.log('Push: SwPush not enabled, using native PushManager');
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(publicKey) as BufferSource,
        });
        subJson = sub.toJSON();
      }

      // 2. Send subscription to backend
      await firstValueFrom(
        this.http.post('/api/push/subscribe', subJson)
      );

      this.subscribed = true;
      console.log('Push: subscription sent to backend successfully', subJson.endpoint?.substring(0, 60));
      return true;
    } catch (err) {
      console.error('Push subscription failed:', err);
      return false;
    }
  }

  /** Unsubscribe from push notifications */
  async unsubscribe(): Promise<void> {
    try {
      if (this.swPush.isEnabled) {
        const sub = await firstValueFrom(this.swPush.subscription);
        if (sub) {
          await firstValueFrom(
            this.http.post('/api/push/unsubscribe', { endpoint: sub.endpoint })
          );
          await sub.unsubscribe();
        }
      } else if (this.isSupported) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await firstValueFrom(
            this.http.post('/api/push/unsubscribe', { endpoint: sub.endpoint })
          );
          await sub.unsubscribe();
        }
      }
      this.subscribed = false;
      console.log('Push: unsubscribed');
    } catch (err) {
      console.error('Push unsubscribe failed:', err);
    }
  }

  /** Listen for incoming push notification clicks */
  listenForNotificationClicks(callback: (url: string) => void): void {
    if (this.swPush.isEnabled) {
      this.swPush.notificationClicks.subscribe((event) => {
        const url = event.notification?.data?.url || '/';
        callback(url);
      });
    }
  }

  /** Convert a base64url-encoded string to a Uint8Array (for applicationServerKey) */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /** Register the custom push-sw.js if no service worker is active yet */
  private async ensurePushServiceWorker(): Promise<void> {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.length === 0) {
        console.log('Push: no service worker found, registering push-sw.js');
        await navigator.serviceWorker.register('/push-sw.js');
        await navigator.serviceWorker.ready;
        console.log('Push: push-sw.js registered and ready');
      } else {
        console.log('Push: existing service worker found, scope:', regs[0].scope);
      }
    } catch (err) {
      console.warn('Push: could not register push service worker:', err);
    }
  }
}
