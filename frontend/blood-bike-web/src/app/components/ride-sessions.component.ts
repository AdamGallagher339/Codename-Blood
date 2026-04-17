import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RideSessionService } from '../services/ride-session.service';
import { RideSession } from '../models/ride-session.model';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-ride-sessions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <header class="page-header">
        <h1>Ride Sessions</h1>
        <p>Track rider-bike sessions, mileage, and duration.</p>
        <div class="stats">
          <div class="stat"><span class="stat-value">{{ totalSessions() }}</span><span class="stat-label">Total</span></div>
          <div class="stat"><span class="stat-value">{{ activeSessions() }}</span><span class="stat-label">Active</span></div>
          <div class="stat"><span class="stat-value">{{ totalMiles() }}</span><span class="stat-label">Miles Logged</span></div>
        </div>
      </header>

      <!-- Start Session Form -->
      <section class="section" *ngIf="showForm()">
        <h2>Start New Session</h2>
        <div class="form-row">
          <div class="field">
            <label>Bike ID</label>
            <input type="text" [(ngModel)]="formBikeId" placeholder="e.g. BB21-WES" />
          </div>
          <div class="field">
            <label>Depot</label>
            <input type="text" [(ngModel)]="formDepot" placeholder="e.g. Galway" />
          </div>
          <div class="field">
            <label>Start Mileage</label>
            <input type="number" [(ngModel)]="formStartMiles" />
          </div>
        </div>
        <div class="form-actions">
          <button class="btn-primary" [disabled]="!formBikeId" (click)="startSession()">Start Session</button>
          <button class="btn-secondary" (click)="showForm.set(false)">Cancel</button>
        </div>
      </section>

      <button *ngIf="!showForm()" class="btn-primary" (click)="showForm.set(true)">+ New Session</button>

      <!-- Active Sessions -->
      <section class="section" *ngIf="activeList().length">
        <h2>Active Sessions</h2>
        <div class="session-list">
          <div class="session-card active" *ngFor="let s of activeList()">
            <div class="session-info">
              <strong>{{ s.bikeId }}</strong>
              <span class="badge active-badge">Active</span>
            </div>
            <div class="session-meta">
              <span>Rider: {{ s.riderId }}</span>
              <span>Depot: {{ s.depot || '—' }}</span>
              <span>Started: {{ s.startTime | date:'short' }}</span>
              <span>Start Miles: {{ s.startMiles }}</span>
            </div>
            <div class="session-actions">
              <div class="end-form">
                <label>End Miles:</label>
                <input type="number" [(ngModel)]="endMilesMap[s.sessionId]" />
                <button class="btn-danger" (click)="endSession(s.sessionId)">End Session</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Completed Sessions -->
      <section class="section">
        <h2>Session History</h2>
        <div class="session-list" *ngIf="completedList().length; else noHistory">
          <div class="session-card" *ngFor="let s of completedList()">
            <div class="session-info">
              <strong>{{ s.bikeId }}</strong>
              <span class="badge completed-badge">Completed</span>
            </div>
            <div class="session-meta">
              <span>Rider: {{ s.riderId }}</span>
              <span>Depot: {{ s.depot || '—' }}</span>
              <span>{{ s.startTime | date:'short' }} – {{ s.endTime | date:'short' }}</span>
              <span>Miles: {{ s.startMiles }} → {{ s.endMiles }} ({{ s.endMiles - s.startMiles }})</span>
            </div>
          </div>
        </div>
        <ng-template #noHistory>
          <p class="empty">No completed sessions yet.</p>
        </ng-template>
      </section>
    </div>
  `,
  styles: [`
    .page-container { padding: 20px; max-width: 1200px; margin: 0 auto; }
    .page-header { margin-bottom: 20px; }
    .page-header h1 { margin: 0 0 4px; }
    .page-header p { margin: 0 0 16px; color: #666; }
    .stats { display: flex; gap: 20px; }
    .stat { background: #f8f9fa; padding: 12px 20px; border-radius: 8px; text-align: center; }
    .stat-value { display: block; font-size: 1.5rem; font-weight: 700; }
    .stat-label { font-size: 0.8rem; color: #666; }
    .section { margin: 20px 0; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; }
    .section h2 { margin: 0 0 12px; font-size: 1.1rem; }
    .form-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .field { flex: 1; min-width: 150px; }
    .field label { display: block; font-weight: 600; margin-bottom: 4px; font-size: 0.85rem; }
    .field input { width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 4px; }
    .form-actions { margin-top: 12px; display: flex; gap: 8px; }
    .btn-primary { padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; }
    .btn-primary:hover:not(:disabled) { background: #1d4ed8; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer; }
    .btn-danger { padding: 6px 12px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem; }
    .session-list { display: flex; flex-direction: column; gap: 12px; }
    .session-card { padding: 12px 16px; border: 1px solid #e5e7eb; border-radius: 6px; background: #fff; }
    .session-card.active { border-left: 4px solid #22c55e; }
    .session-info { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .session-meta { display: flex; flex-wrap: wrap; gap: 16px; font-size: 0.85rem; color: #555; }
    .badge { font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; font-weight: 600; }
    .active-badge { background: #dcfce7; color: #166534; }
    .completed-badge { background: #e0e7ff; color: #3730a3; }
    .session-actions { margin-top: 8px; }
    .end-form { display: flex; align-items: center; gap: 8px; }
    .end-form label { font-size: 0.85rem; font-weight: 600; }
    .end-form input { width: 100px; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; }
    .empty { color: #999; font-style: italic; }
  `]
})
export class RideSessionsComponent {
  private sessionService = inject(RideSessionService);
  private auth = inject(AuthService);

  sessions = this.sessionService.getSessions();
  showForm = signal(false);

  formBikeId = '';
  formDepot = '';
  formStartMiles = 0;
  endMilesMap: Record<string, number> = {};

  totalSessions = computed(() => this.sessions().length);
  activeSessions = computed(() => this.activeList().length);
  totalMiles = computed(() =>
    this.sessions()
      .filter(s => s.endMiles > 0)
      .reduce((sum, s) => sum + (s.endMiles - s.startMiles), 0)
  );

  activeList = computed(() =>
    this.sessions()
      .filter(s => !s.endTime || new Date(s.endTime).getTime() <= 0)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
  );

  completedList = computed(() =>
    this.sessions()
      .filter(s => s.endTime && new Date(s.endTime).getTime() > 0)
      .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
  );

  startSession(): void {
    this.sessionService.createSession({
      bikeId: this.formBikeId,
      riderId: this.auth.username(),
      depot: this.formDepot,
      startMiles: this.formStartMiles,
    }).subscribe((ok) => {
      if (ok) {
        this.formBikeId = '';
        this.formDepot = '';
        this.formStartMiles = 0;
        this.showForm.set(false);
      }
    });
  }

  endSession(sessionId: string): void {
    const endMiles = this.endMilesMap[sessionId] ?? 0;
    this.sessionService.endSession(sessionId, { endMiles }).subscribe();
  }
}
