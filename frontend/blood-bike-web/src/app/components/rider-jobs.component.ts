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
    <div class="page-container">
      <h1>Rider - Jobs</h1>

      <!-- Active job banner -->
      <div *ngIf="jobService.myActiveJob()" class="active-job-banner" (click)="openActiveJob()">
        <div class="banner-left">
          <span class="banner-icon">🏍️</span>
          <div>
            <strong>{{ jobService.myActiveJob()!.title }}</strong>
            <span class="banner-status">{{ statusLabel(jobService.myActiveJob()!) }}</span>
          </div>
        </div>
        <span class="banner-arrow">→</span>
      </div>

      <section class="section">
        <h2>Available Jobs</h2>
        <button (click)="jobService.loadJobs()" [disabled]="jobService.loading()" class="reload-btn">
          {{ jobService.loading() ? 'Loading…' : '↻ Reload' }}
        </button>
        <div *ngIf="jobService.loading()">Loading…</div>
        <table *ngIf="!jobService.loading()">
          <thead>
            <tr>
              <th>Title</th>
              <th class="hide-mobile">Pickup</th>
              <th class="hide-mobile">Delivery</th>
              <th class="hide-mobile">Created By</th>
              <th class="hide-mobile">Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngIf="jobService.openJobs().length === 0">
              <td colspan="6">No available jobs at this time</td>
            </tr>
            <tr *ngFor="let j of jobService.openJobs()">
              <td>
                {{ j.title }}
                <div class="mobile-detail">
                  <small>{{ j.pickup?.address }} → {{ j.dropoff?.address }}</small>
                </div>
              </td>
              <td class="hide-mobile">{{ j.pickup?.address }}</td>
              <td class="hide-mobile">{{ j.dropoff?.address }}</td>
              <td class="hide-mobile">{{ j.createdBy }}</td>
              <td class="hide-mobile">{{ j.timestamps?.created | date:'short' }}</td>
              <td>
                <button
                  (click)="acceptJob(j)"
                  [disabled]="!!jobService.myActiveJob()"
                  class="accept-btn"
                >Accept</button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>My Jobs History</h2>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th class="hide-mobile">Pickup</th>
              <th class="hide-mobile">Delivery</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngIf="completedJobs.length === 0">
              <td colspan="4">No completed jobs</td>
            </tr>
            <tr *ngFor="let j of completedJobs">
              <td>{{ j.title }}</td>
              <td class="hide-mobile">{{ j.pickup?.address }}</td>
              <td class="hide-mobile">{{ j.dropoff?.address }}</td>
              <td><span class="status-badge" [class]="'status-' + j.status">{{ j.status }}</span></td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  `,
  styles: [`
    .page-container {
      padding: 16px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .section {
      margin: 20px 0;
      padding: 15px;
      border: 1px solid #ddd;
      border-radius: 8px;
      background: white;
    }

    .active-job-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      background: linear-gradient(135deg, #007bff, #0056b3);
      color: white;
      border-radius: 10px;
      cursor: pointer;
      margin-bottom: 16px;
      transition: transform 0.15s;
      box-shadow: 0 4px 12px rgba(0,123,255,0.3);
    }
    .active-job-banner:active { transform: scale(0.98); }
    .banner-left { display: flex; align-items: center; gap: 12px; }
    .banner-icon { font-size: 1.5em; }
    .banner-left strong { display: block; font-size: 1.05em; }
    .banner-status { font-size: 0.85em; opacity: 0.9; }
    .banner-arrow { font-size: 1.3em; font-weight: bold; }

    .reload-btn {
      padding: 8px 16px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-bottom: 10px;
    }
    .accept-btn {
      padding: 6px 14px;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .accept-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .accept-btn:hover:not(:disabled) { background-color: #0056b3; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
    .status-badge { padding: 3px 8px; border-radius: 12px; font-size: 0.85em; font-weight: 500; }
    .status-open { background: #fff3e0; color: #e65100; }
    .status-accepted { background: #e3f2fd; color: #1565c0; }
    .status-picked-up { background: #fff8e1; color: #f57f17; }
    .status-delivered, .status-completed { background: #e8f5e9; color: #2e7d32; }
    .status-cancelled { background: #fce4ec; color: #c62828; }

    .mobile-detail { display: none; }

    @media (max-width: 768px) {
      .hide-mobile { display: none; }
      .mobile-detail { display: block; color: #777; margin-top: 4px; }
    }
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
