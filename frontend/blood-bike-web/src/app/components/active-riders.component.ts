import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface Rider {
  riderId: string;
  name: string;
  status: string;
  availableUntil: string;
  currentJobId: string;
}

@Component({
  selector: 'app-active-riders',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="riders-page">
      <header class="page-header">
        <div>
          <h1>Active Riders</h1>
          <p>Monitor rider availability and live dispatch status.</p>
        </div>
        <button (click)="load()" [disabled]="loading" class="reload-btn">{{ loading ? 'Refreshing...' : 'Refresh' }}</button>
      </header>

      <section class="stats-row">
        <article class="stat-card available">
          <span class="label">Available</span>
          <strong>{{ available.length }}</strong>
        </article>
        <article class="stat-card on-job">
          <span class="label">On a Job</span>
          <strong>{{ onJob.length }}</strong>
        </article>
        <article class="stat-card offline">
          <span class="label">Offline</span>
          <strong>{{ offline.length }}</strong>
        </article>
      </section>

      <section class="section-card">
        <div class="section-head">
          <h2>Available</h2>
          <span class="count">{{ available.length }}</span>
        </div>
        <div *ngIf="available.length === 0" class="empty">No riders currently available</div>
        <article *ngFor="let r of available" class="rider-card available">
          <span class="dot green"></span>
          <div class="info">
            <strong>{{ r.name || r.riderId }}</strong>
            <span class="meta" *ngIf="r.availableUntil">Available until {{ r.availableUntil | date:'short' }}</span>
          </div>
        </article>
      </section>

      <section class="section-card">
        <div class="section-head">
          <h2>On a Job</h2>
          <span class="count">{{ onJob.length }}</span>
        </div>
        <div *ngIf="onJob.length === 0" class="empty">No riders currently on a job</div>
        <article *ngFor="let r of onJob" class="rider-card on-job">
          <span class="dot orange"></span>
          <div class="info">
            <strong>{{ r.name || r.riderId }}</strong>
            <span class="meta">Job: {{ jobTitles[r.currentJobId] || r.currentJobId }}</span>
          </div>
        </article>
      </section>

      <section class="section-card">
        <div class="section-head">
          <h2>Offline</h2>
          <span class="count">{{ offline.length }}</span>
        </div>
        <div *ngIf="offline.length === 0" class="empty">No offline riders</div>
        <article *ngFor="let r of offline" class="rider-card offline">
          <span class="dot grey"></span>
          <div class="info">
            <strong>{{ r.name || r.riderId }}</strong>
          </div>
        </article>
      </section>
    </div>
  `,
  styles: [`
    .riders-page {
      padding: var(--spacing-lg);
      max-width: 1080px;
      margin: 0 auto;
      display: grid;
      gap: var(--spacing-lg);
      background: #f8f9fa;
      min-height: 100vh;
    }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--spacing-md);
      background: var(--color-white);
      border: 1px solid #e5e7eb;
      border-radius: var(--border-radius-lg);
      padding: var(--spacing-lg);
      box-shadow: var(--shadow-sm);
    }

    .page-header h1 {
      margin: 0 0 4px;
      font-size: var(--font-size-2xl);
      color: var(--color-text-dark);
    }

    .page-header p {
      margin: 0;
      color: #7a7a7a;
      font-size: var(--font-size-sm);
      font-weight: 500;
    }

    .reload-btn {
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid #d3d8df;
      background: var(--color-white);
      cursor: pointer;
      font-weight: 600;
      color: #374151;
      min-width: 110px;
    }

    .reload-btn:hover {
      background: #f4f6f8;
    }

    .reload-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: var(--spacing-md);
    }

    .stat-card {
      padding: var(--spacing-md) var(--spacing-lg);
      border-radius: var(--border-radius-md);
      background: var(--color-white);
      border: 1px solid #e5e7eb;
      box-shadow: var(--shadow-sm);
      display: grid;
      gap: 2px;
    }

    .stat-card .label {
      font-size: var(--font-size-xs);
      text-transform: uppercase;
      color: #7a7a7a;
      letter-spacing: 0.04em;
      font-weight: 700;
    }

    .stat-card strong {
      font-size: var(--font-size-2xl);
      line-height: 1.1;
    }

    .stat-card.available strong { color: #2e7d32; }
    .stat-card.on-job strong { color: #b45309; }
    .stat-card.offline strong { color: #6b7280; }

    .section-card {
      background: var(--color-white);
      border: 1px solid #e5e7eb;
      border-radius: var(--border-radius-lg);
      padding: var(--spacing-lg);
      box-shadow: var(--shadow-sm);
      display: grid;
      gap: var(--spacing-sm);
    }

    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }

    .section-head h2 {
      margin: 0;
      font-size: var(--font-size-lg);
      color: var(--color-text-dark);
    }

    .count {
      border-radius: 999px;
      background: #eef2f7;
      color: #374151;
      font-size: var(--font-size-xs);
      font-weight: 700;
      padding: 4px 10px;
    }

    .rider-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 12px;
      margin-bottom: 4px;
      border: 1px solid #eceff3;
      background: #fbfcfd;
    }

    .rider-card.available { border-left: 4px solid #4caf50; }
    .rider-card.on-job { border-left: 4px solid #ff9800; }
    .rider-card.offline { border-left: 4px solid #9e9e9e; opacity: 0.8; }

    .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .dot.green { background: #4caf50; }
    .dot.orange { background: #ff9800; }
    .dot.grey { background: #9e9e9e; }

    .info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .info strong {
      color: #111827;
    }

    .meta {
      font-size: var(--font-size-xs);
      color: #6b7280;
    }

    .empty {
      color: #9ca3af;
      font-style: italic;
      padding: 4px 2px 8px;
    }

    @media (max-width: 768px) {
      .riders-page {
        padding: var(--spacing-md);
      }

      .page-header {
        flex-direction: column;
      }
    }
  `]
})
export class ActiveRidersComponent implements OnInit, OnDestroy {
  loading = false;
  available: Rider[] = [];
  onJob: Rider[] = [];
  offline: Rider[] = [];
  jobTitles: Record<string, string> = {};
  private timer: any;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.load();
    this.timer = setInterval(() => this.load(), 30_000);
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }

  load() {
    this.loading = true;
    this.http.get<any[]>('/api/jobs').subscribe({
      next: jobs => {
        this.jobTitles = {};
        for (const j of jobs || []) {
          if (j.jobId && j.title) this.jobTitles[j.jobId] = j.title;
        }
      }
    });
    this.http.get<Rider[]>('/api/riders/availability').subscribe({
      next: riders => {
        this.available = riders.filter(r => r.status === 'available');
        this.onJob = riders.filter(r => r.status === 'on-job');
        this.offline = riders.filter(r => r.status === 'offline' || !r.status);
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }
}
