import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { JobService } from '../services/job.service';
import { AuthService } from '../services/auth.service';
import { Job } from '../models/job.model';

@Component({
  selector: 'app-rider-jobs',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="jobs-page">

      <!-- Active Job Banner -->
      <div *ngIf="jobService.myActiveJob()" class="active-banner" (click)="openActiveJob()">
        <div class="banner-pulse"></div>
        <div class="banner-body">
          <span class="banner-icon">🏍️</span>
          <div class="banner-info">
            <span class="banner-title">{{ jobService.myActiveJob()!.title }}</span>
            <span class="banner-status">{{ statusLabel(jobService.myActiveJob()!) }}</span>
          </div>
        </div>
        <span class="banner-chevron">›</span>
      </div>

      <!-- Available Jobs -->
      <div class="section-head">
        <span class="section-title">Available</span>
        <button class="btn-refresh" (click)="jobService.loadJobs()" [disabled]="jobService.loading()">
          {{ jobService.loading() ? '...' : '↻' }}
        </button>
      </div>

      <div *ngIf="jobService.loading()" class="loading-state">
        <div class="loader"></div>
      </div>

      <div *ngIf="!jobService.loading() && jobService.openJobs().length === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-text">No jobs available right now</div>
      </div>

      <div class="job-list" *ngIf="!jobService.loading()">
        <div class="job-card" *ngFor="let j of jobService.openJobs()">
          <div class="job-card-header">
            <span class="job-title">{{ j.title }}</span>
            <span class="job-time">{{ j.timestamps?.created | date:'shortTime' }}</span>
          </div>
          <div class="job-route">
            <div class="route-point pickup">
              <span class="route-dot"></span>
              <span class="route-addr">{{ j.pickup?.address || 'No address' }}</span>
            </div>
            <div class="route-line"></div>
            <div class="route-point dropoff">
              <span class="route-dot"></span>
              <span class="route-addr">{{ j.dropoff?.address || 'No address' }}</span>
            </div>
          </div>
          <div class="job-card-footer">
            <span class="job-meta">By {{ j.createdBy }}</span>
            <button
              class="btn-accept"
              (click)="acceptJob(j)"
              [disabled]="!!jobService.myActiveJob()"
            >Accept</button>
          </div>
        </div>
      </div>

      <!-- History -->
      <div class="section-head history-head">
        <span class="section-title">History</span>
        <span class="history-count" *ngIf="completedJobs.length">{{ completedJobs.length }}</span>
      </div>

      <div *ngIf="completedJobs.length === 0" class="empty-state small">
        <div class="empty-text">No completed jobs yet</div>
      </div>

      <div class="history-list">
        <div class="history-item" *ngFor="let j of completedJobs">
          <div class="history-left">
            <span class="history-title">{{ j.title }}</span>
            <span class="history-route">{{ j.pickup?.address || '?' }} → {{ j.dropoff?.address || '?' }}</span>
          </div>
          <span class="status-pill" [class]="'s-' + j.status">{{ j.status }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .jobs-page {
      padding: 1rem;
      max-width: 500px;
      margin: 0 auto;
    }

    /* ── Active Banner ── */
    .active-banner {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      background: linear-gradient(135deg, #0d3320, #14532d);
      border-radius: 16px;
      cursor: pointer;
      margin-bottom: 1.25rem;
      overflow: hidden;
      -webkit-tap-highlight-color: transparent;
    }
    .active-banner:active { transform: scale(0.98); }
    .banner-pulse {
      position: absolute;
      inset: 0;
      border: 2px solid #4ade80;
      border-radius: 16px;
      animation: pulse-ring 2s ease-out infinite;
      pointer-events: none;
    }
    @keyframes pulse-ring {
      0% { opacity: 0.6; transform: scale(1); }
      100% { opacity: 0; transform: scale(1.03); }
    }
    .banner-body {
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 1;
    }
    .banner-icon { font-size: 1.5rem; }
    .banner-info { display: flex; flex-direction: column; }
    .banner-title { color: #fff; font-weight: 700; font-size: 1rem; }
    .banner-status { color: #bbf7d0; font-size: 0.8rem; }
    .banner-chevron { color: #4ade80; font-size: 1.6rem; font-weight: 300; z-index: 1; }

    /* ── Section Heads ── */
    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .section-title {
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #888;
    }
    .btn-refresh {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 1.5px solid #333;
      background: #1a1a1a;
      color: #aaa;
      font-size: 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      -webkit-tap-highlight-color: transparent;
    }
    .btn-refresh:hover { border-color: #555; color: #fff; }
    .btn-refresh:disabled { opacity: 0.4; }

    /* ── Loading ── */
    .loading-state {
      display: flex;
      justify-content: center;
      padding: 2rem 0;
    }
    .loader {
      width: 28px;
      height: 28px;
      border: 3px solid #333;
      border-top-color: var(--color-red, #dc143c);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Empty State ── */
    .empty-state {
      text-align: center;
      padding: 2rem 1rem;
      color: #666;
    }
    .empty-state.small { padding: 1rem; }
    .empty-icon { font-size: 2rem; margin-bottom: 0.5rem; }
    .empty-text { font-size: 0.9rem; }

    /* ── Job Cards ── */
    .job-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }
    .job-card {
      background: #1a1a1a;
      border-radius: 14px;
      padding: 14px 16px;
      border: 1px solid #2a2a2a;
    }
    .job-card-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 10px;
    }
    .job-title {
      font-weight: 700;
      font-size: 1rem;
      color: #fff;
    }
    .job-time {
      font-size: 0.75rem;
      color: #666;
    }

    /* ── Route Visualization ── */
    .job-route {
      display: flex;
      flex-direction: column;
      gap: 0;
      margin-bottom: 12px;
      padding-left: 4px;
    }
    .route-point {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .route-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .pickup .route-dot { background: #4ade80; }
    .dropoff .route-dot { background: var(--color-red, #dc143c); }
    .route-addr {
      font-size: 0.85rem;
      color: #bbb;
    }
    .route-line {
      width: 2px;
      height: 14px;
      background: #333;
      margin-left: 4px;
    }

    .job-card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .job-meta {
      font-size: 0.75rem;
      color: #666;
    }
    .btn-accept {
      padding: 8px 20px;
      border-radius: 20px;
      border: none;
      background: var(--color-red, #dc143c);
      color: #fff;
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.15s;
      -webkit-tap-highlight-color: transparent;
    }
    .btn-accept:hover:not(:disabled) { background: #b01030; }
    .btn-accept:disabled { opacity: 0.35; cursor: not-allowed; }

    /* ── History ── */
    .history-head { margin-top: 0.5rem; }
    .history-count {
      background: #2a2a2a;
      color: #888;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 10px;
    }
    .history-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .history-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      background: #1a1a1a;
      border-radius: 10px;
      border: 1px solid #222;
    }
    .history-left {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      flex: 1;
    }
    .history-title {
      font-size: 0.9rem;
      font-weight: 600;
      color: #ddd;
    }
    .history-route {
      font-size: 0.75rem;
      color: #666;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .status-pill {
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      flex-shrink: 0;
      margin-left: 10px;
    }
    .s-delivered, .s-completed { background: #14532d; color: #bbf7d0; }
    .s-cancelled { background: #7f1d1d; color: #fecaca; }
    .s-open { background: #78350f; color: #fde68a; }
    .s-accepted { background: #1e3a5f; color: #93c5fd; }
    .s-picked-up { background: #713f12; color: #fde68a; }
  `]
})
export class RiderJobsComponent implements OnInit {
  constructor(
    public jobService: JobService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.jobService.loadJobs();
  }

  get completedJobs(): Job[] {
    const username = this.auth.username?.() || '';
    return this.jobService.jobs().filter(
      j => j.acceptedBy === username && (j.status === 'delivered' || j.status === 'completed' || j.status === 'cancelled')
    );
  }

  statusLabel(job: Job): string {
    switch (job.status) {
      case 'accepted': return 'En route to pickup';
      case 'picked-up': return 'Parcel collected — delivering';
      default: return job.status;
    }
  }

  async acceptJob(job: Job): Promise<void> {
    try {
      await this.jobService.acceptJob(job);
      this.router.navigate(['/active-job']);
    } catch (err: any) {
      alert('Failed to accept job: ' + (err?.error || err?.message || 'Unknown error'));
    }
  }

  openActiveJob(): void {
    this.router.navigate(['/active-job']);
  }
}
