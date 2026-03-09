import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-rider-availability',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="avail-page">
      <!-- Status Hero Card -->
      <div class="status-card" [class.online]="currentStatus === 'available'">
        <div class="status-pulse" *ngIf="currentStatus === 'available'"></div>
        <div class="status-icon">{{ currentStatus === 'available' ? '🟢' : '⚫' }}</div>
        <div class="status-label">{{ currentStatus === 'available' ? 'On Duty' : 'Off Duty' }}</div>
        <div class="status-sub" *ngIf="expiresAt">Until {{ expiresAt | date:'shortTime' }}</div>
        <div class="status-sub" *ngIf="currentStatus === 'available' && !expiresAt">Until you go offline</div>
      </div>

      <!-- Toggle Switch -->
      <div class="toggle-track" [class.on]="currentStatus === 'available'" (click)="toggleStatus()">
        <span class="toggle-label off-label">OFF</span>
        <span class="toggle-thumb"></span>
        <span class="toggle-label on-label">ON</span>
      </div>

      <!-- Duration Picker (only when offline, choosing how long to go available) -->
      <div class="duration-section" *ngIf="currentStatus !== 'available'">
        <div class="duration-heading">Go available for</div>
        <div class="duration-chips">
          <button
            *ngFor="let d of durations"
            class="dur-chip"
            [class.selected]="selectedDuration === d.value"
            (click)="selectedDuration = d.value"
          >{{ d.label }}</button>
        </div>
      </div>

      <!-- Toast Message -->
      <div *ngIf="message" class="toast" [class.error]="isError" [class.show]="message">
        {{ message }}
      </div>
    </div>
  `,
  styles: [`
    .avail-page {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1.5rem 1rem 2rem;
      max-width: 420px;
      margin: 0 auto;
      gap: 1.5rem;
    }

    /* ── Status Hero ── */
    .status-card {
      position: relative;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
      padding: 2rem 1rem;
      border-radius: 20px;
      background: #1a1a1a;
      color: #888;
      transition: all 0.4s ease;
      overflow: hidden;
    }
    .status-card.online {
      background: linear-gradient(135deg, #0d3320, #14532d);
      color: #bbf7d0;
    }
    .status-icon {
      font-size: 2.5rem;
      line-height: 1;
    }
    .status-label {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .status-card.online .status-label { color: #fff; }
    .status-sub {
      font-size: 0.85rem;
      opacity: 0.7;
    }
    .status-pulse {
      position: absolute;
      inset: 0;
      border-radius: 20px;
      border: 2px solid #4ade80;
      animation: pulse-ring 2s ease-out infinite;
      pointer-events: none;
    }
    @keyframes pulse-ring {
      0% { opacity: 0.6; transform: scale(1); }
      100% { opacity: 0; transform: scale(1.04); }
    }

    /* ── Toggle Switch ── */
    .toggle-track {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 200px;
      height: 56px;
      border-radius: 28px;
      background: #2a2a2a;
      cursor: pointer;
      padding: 0 18px;
      transition: background 0.3s ease;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    .toggle-track.on {
      background: #16a34a;
    }
    .toggle-thumb {
      position: absolute;
      top: 4px;
      left: 4px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .toggle-track.on .toggle-thumb {
      transform: translateX(144px);
    }
    .toggle-label {
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: rgba(255,255,255,0.5);
      z-index: 1;
    }
    .toggle-track.on .on-label { color: #fff; }
    .toggle-track:not(.on) .off-label { color: #fff; }

    /* ── Duration Picker ── */
    .duration-section {
      width: 100%;
      text-align: center;
    }
    .duration-heading {
      font-size: 0.85rem;
      font-weight: 600;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 0.75rem;
    }
    .duration-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      justify-content: center;
    }
    .dur-chip {
      padding: 0.5rem 1rem;
      border-radius: 20px;
      border: 1.5px solid #333;
      background: #1a1a1a;
      color: #ccc;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .dur-chip:hover { border-color: #555; }
    .dur-chip.selected {
      background: var(--color-red, #dc143c);
      border-color: var(--color-red, #dc143c);
      color: #fff;
      font-weight: 700;
    }

    /* ── Toast ── */
    .toast {
      width: 100%;
      padding: 0.75rem 1rem;
      border-radius: 12px;
      font-size: 0.9rem;
      font-weight: 500;
      text-align: center;
      background: #14532d;
      color: #bbf7d0;
      animation: toast-in 0.3s ease;
    }
    .toast.error {
      background: #7f1d1d;
      color: #fecaca;
    }
    @keyframes toast-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class RiderAvailabilityComponent implements OnInit, OnDestroy {
  currentStatus = 'offline';
  expiresAt: string | null = null;
  selectedDuration = 0;
  busy = false;
  message: string | null = null;
  isError = false;
  private timer: any;
  private messageTimer: any;

  durations = [
    { label: 'No limit', value: 0 },
    { label: '1h', value: 1 },
    { label: '4h', value: 4 },
    { label: '8h', value: 8 },
    { label: '12h', value: 12 },
    { label: '24h', value: 24 },
  ];

  constructor(private http: HttpClient, private auth: AuthService) {}

  ngOnInit() {
    this.loadCurrent();
    this.timer = setInterval(() => this.loadCurrent(), 30_000);
  }

  ngOnDestroy() {
    clearInterval(this.timer);
    clearTimeout(this.messageTimer);
  }

  private showMessage(msg: string, error = false) {
    this.message = msg;
    this.isError = error;
    clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => this.message = null, 3000);
  }

  toggleStatus() {
    if (this.busy) return;
    if (this.currentStatus === 'available') {
      this.goOffline();
    } else {
      this.setAvailable();
    }
  }

  loadCurrent() {
    this.http.get<any[]>('/api/riders/availability').subscribe({
      next: riders => {
        const me = riders.find(r => r.riderId === this.auth.username());
        if (me) {
          this.currentStatus = me.status || 'offline';
          this.expiresAt = me.availableUntil || null;
        }
      }
    });
  }

  setAvailable() {
    this.busy = true;
    this.message = null;
    this.http.put<any>('/api/riders/availability/me', {
      status: 'available',
      duration: this.selectedDuration
    }).subscribe({
      next: res => {
        this.currentStatus = res.status;
        this.expiresAt = res.availableUntil || null;
        this.showMessage('You are now on duty');
        this.busy = false;
      },
      error: () => {
        this.showMessage('Failed to update status', true);
        this.busy = false;
      }
    });
  }

  goOffline() {
    this.busy = true;
    this.message = null;
    this.http.put<any>('/api/riders/availability/me', {
      status: 'offline',
      duration: 0
    }).subscribe({
      next: res => {
        this.currentStatus = res.status;
        this.expiresAt = null;
        this.selectedDuration = 0;
        this.showMessage('You are now off duty');
        this.busy = false;
      },
      error: () => {
        this.showMessage('Failed to update status', true);
        this.busy = false;
      }
    });
  }
}
