import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../services/auth.service';

interface Job {
  jobId: string;
  title: string;
  status: string;
  createdBy: string;
  acceptedBy: string;
  pickup: { address?: string };
  dropoff: { address?: string };
  timestamps: { created?: string };
}

@Component({
  selector: 'app-rider-jobs',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <h1>Rider - Available Jobs</h1>
      <p>View and accept available delivery jobs.</p>

      <section class="section">
        <h2>My Status</h2>
        <div class="status-controls">
          <label>
            <input type="radio" name="status" value="available" (click)="riderStatus = 'available'" [checked]="riderStatus === 'available'" />
            Available
          </label>
          <label>
            <input type="radio" name="status" value="unavailable" (click)="riderStatus = 'unavailable'" [checked]="riderStatus === 'unavailable'" />
            Unavailable
          </label>
        </div>
      </section>

      <section class="section">
        <h2>Available Jobs</h2>
        <button (click)="loadJobs()" [disabled]="loading" class="reload-btn">{{ loading ? 'Loading…' : '↻ Reload' }}</button>
        <div *ngIf="loading">Loading…</div>
        <table *ngIf="!loading">
          <thead>
            <tr>
              <th>Title</th>
              <th>Pickup</th>
              <th>Delivery</th>
              <th>Created By</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngIf="openJobs.length === 0">
              <td colspan="6">No available jobs at this time</td>
            </tr>
            <tr *ngFor="let j of openJobs">
              <td>{{ j.title }}</td>
              <td>{{ j.pickup?.address }}</td>
              <td>{{ j.dropoff?.address }}</td>
              <td>{{ j.createdBy }}</td>
              <td>{{ j.timestamps?.created | date:'short' }}</td>
              <td><button (click)="acceptJob(j)" [disabled]="riderStatus === 'unavailable'" class="accept-btn">Accept</button></td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>My Active Jobs</h2>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Pickup</th>
              <th>Delivery</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngIf="myJobs.length === 0">
              <td colspan="5">No active jobs</td>
            </tr>
            <tr *ngFor="let j of myJobs">
              <td>{{ j.title }}</td>
              <td>{{ j.pickup?.address }}</td>
              <td>{{ j.dropoff?.address }}</td>
              <td><span class="status-badge" [class]="'status-' + j.status">{{ j.status }}</span></td>
              <td>
                <button *ngIf="j.status === 'accepted'" (click)="completeJob(j)" class="complete-btn">Complete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  `,
  styles: [`
    .page-container {
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .section {
      margin: 20px 0;
      padding: 15px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .status-controls {
      display: flex;
      gap: 20px;
    }
    .status-controls label {
      display: flex;
      align-items: center;
      font-weight: normal;
    }
    .status-controls input {
      margin-right: 8px;
    }
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
    .complete-btn { padding: 6px 14px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; }
    .status-badge { padding: 3px 8px; border-radius: 12px; font-size: 0.85em; font-weight: 500; }
    .status-open { background: #fff3e0; color: #e65100; }
    .status-accepted { background: #e3f2fd; color: #1565c0; }
    .status-completed { background: #e8f5e9; color: #2e7d32; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
  `]
})
export class RiderJobsComponent implements OnInit {
  riderStatus = 'available';
  loading = false;
  jobs: Job[] = [];

  constructor(private http: HttpClient, private auth: AuthService) {}

  ngOnInit(): void {
    this.loadJobs();
  }

  private getHeaders(): HttpHeaders {
    const token = this.auth.getIdToken() || this.auth.getAccessToken();
    return new HttpHeaders({ 'Authorization': `Bearer ${token}` });
  }

  private get username(): string {
    return this.auth.username?.() || '';
  }

  get openJobs(): Job[] {
    return this.jobs.filter(j => j.status === 'open');
  }

  get myJobs(): Job[] {
    return this.jobs.filter(j => j.acceptedBy === this.username && j.status !== 'open');
  }

  loadJobs(): void {
    this.loading = true;
    this.http.get<Job[]>('/api/jobs', { headers: this.getHeaders() }).subscribe({
      next: (jobs) => {
        this.jobs = jobs || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load jobs:', err);
        this.jobs = [];
        this.loading = false;
      }
    });
  }

  acceptJob(job: Job): void {
    const payload = { status: 'accepted', acceptedBy: this.username };
    this.http.put<Job>(`/api/jobs/${job.jobId}`, payload, { headers: this.getHeaders() }).subscribe({
      next: (updated) => {
        const idx = this.jobs.findIndex(j => j.jobId === job.jobId);
        if (idx >= 0) this.jobs[idx] = updated;
      },
      error: (err) => {
        console.error('Failed to accept job:', err);
        alert(`Failed to accept job: ${err.error || err.statusText}`);
      }
    });
  }

  completeJob(job: Job): void {
    const payload = { status: 'completed' };
    this.http.put<Job>(`/api/jobs/${job.jobId}`, payload, { headers: this.getHeaders() }).subscribe({
      next: (updated) => {
        const idx = this.jobs.findIndex(j => j.jobId === job.jobId);
        if (idx >= 0) this.jobs[idx] = updated;
      },
      error: (err) => {
        console.error('Failed to complete job:', err);
        alert(`Failed to complete job: ${err.error || err.statusText}`);
      }
    });
  }
}
