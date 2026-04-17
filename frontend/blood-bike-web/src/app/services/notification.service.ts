import { Injectable, signal } from '@angular/core';

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  message: string;
  level: NotificationLevel;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly hideAfterMs = 5000;
  private readonly duplicateCooldownMs = 4000;

  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private lastShownAtByKey = new Map<string, number>();

  private currentNotification = signal<AppNotification | null>(null);

  notification = this.currentNotification.asReadonly();

  show(message: string, level: NotificationLevel = 'info', key?: string): void {
    const trimmed = message.trim();
    if (!trimmed) return;

    const dedupeKey = key ?? `${level}:${trimmed}`;
    const now = Date.now();
    const previous = this.lastShownAtByKey.get(dedupeKey);

    if (previous && now - previous < this.duplicateCooldownMs) {
      return;
    }

    this.lastShownAtByKey.set(dedupeKey, now);
    this.currentNotification.set({ message: trimmed, level });

    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
    }

    this.hideTimer = setTimeout(() => {
      this.dismiss();
    }, this.hideAfterMs);
  }

  success(message: string, key?: string): void {
    this.show(message, 'success', key);
  }

  info(message: string, key?: string): void {
    this.show(message, 'info', key);
  }

  warning(message: string, key?: string): void {
    this.show(message, 'warning', key);
  }

  error(message: string, key?: string): void {
    this.show(message, 'error', key);
  }

  dismiss(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.currentNotification.set(null);
  }
}
