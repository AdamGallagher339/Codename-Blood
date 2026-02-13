import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-rider-availability',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <h1>My Availability</h1>

      <div class="status-display">
        <span class="dot" [class.green]="currentStatus === 'available'" [class.grey]="currentStatus !== 'available'"></span>
        <span class="status-text">{{ currentStatus === 'available' ? 'Available' : 'Offline' }}</span>
        <span *ngIf="expiresAt" class="expires">Expires: {{ expiresAt | date:'short' }}</span>
      </div>

      <section class="section">
        <h2>Set Status</h2>

        <div class="toggle-row">
          <button
            (click)="setAvailable()"
            [disabled]="busy"
            [class.active]="currentStatus === 'available'"
            class="toggle-btn available-btn">
            ✅ Available
          </button>
          <button
            (click)="goOffline()"
            [disabled]="busy"
            [class.active]="currentStatus === 'offline'"
            class="toggle-btn offline-btn">
            ⛔ Offline
          </button>
        </div>

        <div class="timer-section" *ngIf="currentStatus !== 'available'">
          <label>Stay available for:</label>
          <select [(ngModel)]="selectedDuration">
            <option [ngValue]="0">No timer (until I go offline)</option>
            <option [ngValue]="1">1 hour</option>
            <option [ngValue]="4">4 hours</option>
            <option [ngValue]="8">8 hours</option>
            <option [ngValue]="12">12 hours</option>
            <option [ngValue]="24">24 hours</option>
          </select>
        </div>

        <p *ngIf="message" class="message" [class.error]="isError">{{ message }}</p>
      </section>
    </div>
  `,
  styles: [`
    .page-container { padding: 1rem; max-width: 500px; margin: auto; }
    .status-display { display: flex; align-items: center; gap: .75rem; padding: 1rem; background: #f5f5f5; border-radius: 8px; margin-bottom: 1.5rem; }
    .dot { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; }
    .dot.green { background: #4caf50; }
    .dot.grey { background: #9e9e9e; }
    .status-text { font-size: 1.2rem; font-weight: 600; }
    .expires { font-size: .85rem; color: #666; margin-left: auto; }
    .toggle-row { display: flex; gap: 1rem; margin-bottom: 1rem; }
    .toggle-btn { flex: 1; padding: .75rem; border-radius: 8px; border: 2px solid #ccc; font-size: 1rem; cursor: pointer; background: white; }
    .toggle-btn.active { border-color: #333; font-weight: 700; }
    .available-btn.active { background: #e8f5e9; border-color: #4caf50; }
    .offline-btn.active { background: #fbe9e7; border-color: #e53935; }
    .timer-section { margin-top: 1rem; }
    .timer-section label { display: block; margin-bottom: .5rem; font-weight: 500; }
    .timer-section select { width: 100%; padding: .5rem; border-radius: 6px; border: 1px solid #ccc; font-size: 1rem; }
    .section { margin-top: 1rem; }
    .message { margin-top: .75rem; padding: .5rem; border-radius: 6px; background: #e8f5e9; }
    .message.error { background: #fbe9e7; color: #c62828; }
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

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadCurrent();
    this.timer = setInterval(() => this.loadCurrent(), 30_000);
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }

  loadCurrent() {
    this.http.get<any[]>('/api/riders/availability').subscribe({
      next: riders => {
        // Find ourselves — the backend uses the JWT username
        // We'll just grab the status from the update response instead, 
        // for now load from the list
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
        this.message = 'You are now available';
        this.isError = false;
        this.busy = false;
      },
      error: () => {
        this.message = 'Failed to update status';
        this.isError = true;
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
        this.message = 'You are now offline';
        this.isError = false;
        this.busy = false;
      },
      error: () => {
        this.message = 'Failed to update status';
        this.isError = true;
        this.busy = false;
      }
    });
  }
}
