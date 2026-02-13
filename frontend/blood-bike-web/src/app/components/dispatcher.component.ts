import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  selector: 'app-dispatcher',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dispatcher">
      <h1>Dispatcher Dashboard</h1>
      <p class="subtitle">Create new jobs, view available riders, and manage delivery runs.</p>

      <!-- Create Job -->
      <section class="card">
        <h2>Create New Job</h2>
        <div class="form-stack">
          <label>
            <span>Job Title</span>
            <input type="text" [(ngModel)]="newJob.title" placeholder="Enter job title" />
          </label>
          <label>
            <span>Pickup Address</span>
            <input type="text" [(ngModel)]="newJob.pickup" placeholder="Pickup location" />
          </label>
          <label>
            <span>Delivery Address</span>
            <input type="text" [(ngModel)]="newJob.dropoff" placeholder="Delivery location" />
          </label>
          <button class="btn-primary" (click)="createJob()" [disabled]="busy || !newJob.title">{{ busy ? 'Creating…' : 'Create Job' }}</button>
          <p *ngIf="message" class="msg" [class.error]="isError">{{ message }}</p>
        </div>
      </section>

      <!-- All Jobs -->
      <section class="card">
        <div class="card-top">
          <h2>All Jobs</h2>
          <button class="btn-reload" (click)="loadJobs()" [disabled]="loading">{{ loading ? 'Loading…' : '↻ Reload' }}</button>
        </div>
        <div *ngIf="loading" class="loading">Loading…</div>

        <!-- Desktop table -->
        <div class="table-wrap" *ngIf="!loading">
          <table>
            <thead>
              <tr>
                <th>Title</th><th>Pickup</th><th>Delivery</th><th>Status</th>
                <th>Created By</th><th>Accepted By</th><th>Created</th><th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngIf="jobs.length === 0"><td colspan="8">No jobs yet</td></tr>
              <tr *ngFor="let j of jobs">
                <td>{{ j.title }}</td>
                <td>{{ j.pickup?.address }}</td>
                <td>{{ j.dropoff?.address }}</td>
                <td><span class="badge" [class]="'s-' + j.status">{{ j.status }}</span></td>
                <td>{{ j.createdBy }}</td>
                <td>{{ j.acceptedBy || '—' }}</td>
                <td>{{ j.timestamps?.created | date:'short' }}</td>
                <td><button class="btn-delete" (click)="deleteJob(j)">Delete</button></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile cards -->
        <div class="job-cards" *ngIf="!loading">
          <div *ngIf="jobs.length === 0" class="empty">No jobs yet</div>
          <div class="job-card" *ngFor="let j of jobs">
            <div class="job-card-top">
              <strong>{{ j.title }}</strong>
              <span class="badge" [class]="'s-' + j.status">{{ j.status }}</span>
            </div>
            <div class="job-detail"><span>Pickup:</span> {{ j.pickup?.address || '—' }}</div>
            <div class="job-detail"><span>Delivery:</span> {{ j.dropoff?.address || '—' }}</div>
            <div class="job-detail"><span>Created:</span> {{ j.timestamps?.created | date:'short' }}</div>
            <div class="job-detail" *ngIf="j.acceptedBy"><span>Accepted by:</span> {{ j.acceptedBy }}</div>
            <button class="btn-delete" (click)="deleteJob(j)">Delete</button>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .dispatcher { padding: 1rem; max-width: 900px; margin: 0 auto; }
    .subtitle { color: #666; margin: 0 0 1rem; }
    .card { background: #fff; border: 1px solid #e0e0e0; border-radius: 10px; padding: 1.25rem; margin-bottom: 1.25rem; }
    .card h2 { margin: 0 0 1rem; font-size: 1.15rem; }
    .card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: .75rem; }
    .card-top h2 { margin: 0; }
    .form-stack { display: flex; flex-direction: column; gap: .75rem; }
    .form-stack label { display: flex; flex-direction: column; gap: 4px; }
    .form-stack label span { font-weight: 600; font-size: .9rem; color: #333; }
    .form-stack input { padding: .6rem .75rem; border: 1px solid #ccc; border-radius: 8px; font-size: 1rem; }
    .form-stack input:focus { outline: none; border-color: #dc143c; box-shadow: 0 0 0 3px rgba(220,20,60,.12); }
    .btn-primary { padding: .65rem 1.25rem; background: #dc143c; color: #fff; border: none; border-radius: 8px; font-weight: 700; font-size: 1rem; cursor: pointer; }
    .btn-primary:hover:not(:disabled) { background: #b01030; }
    .btn-primary:disabled { opacity: .55; cursor: not-allowed; }
    .btn-reload { padding: .45rem 1rem; background: #4caf50; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
    .btn-delete { padding: .35rem .75rem; background: #d32f2f; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: .85rem; }
    .msg { margin: 0; padding: .6rem .75rem; border-radius: 8px; background: #e8f5e9; color: #2e7d32; font-size: .9rem; }
    .msg.error { background: #fbe9e7; color: #c62828; }
    .badge { padding: 3px 10px; border-radius: 20px; font-size: .8rem; font-weight: 600; white-space: nowrap; }
    .s-open { background: #fff3e0; color: #e65100; }
    .s-accepted { background: #e3f2fd; color: #1565c0; }
    .s-completed { background: #e8f5e9; color: #2e7d32; }
    .loading { text-align: center; padding: 2rem; color: #999; }
    .empty { text-align: center; padding: 2rem; color: #999; font-style: italic; }

    /* Desktop table */
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: .6rem .75rem; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #fafafa; font-size: .85rem; color: #666; font-weight: 600; }

    /* Mobile cards hidden on desktop */
    .job-cards { display: none; }

    @media (max-width: 700px) {
      .table-wrap { display: none; }
      .job-cards { display: flex; flex-direction: column; gap: .75rem; }
      .job-card { background: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: .75rem; }
      .job-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: .5rem; }
      .job-detail { font-size: .9rem; color: #444; margin-bottom: .25rem; }
      .job-detail span { font-weight: 600; color: #222; }
      .job-card .btn-delete { margin-top: .5rem; width: 100%; }
    }
  `]
})
export class DispatcherComponent implements OnInit {
  newJob = { title: '', pickup: '', dropoff: '' };
  busy = false;
  loading = false;
  message: string | null = null;
  isError = false;
  jobs: Job[] = [];

  constructor(private http: HttpClient, private auth: AuthService) {}

  ngOnInit(): void {
    this.loadJobs();
  }

  private getHeaders(): HttpHeaders {
    const token = this.auth.getIdToken() || this.auth.getAccessToken();
    return new HttpHeaders({ 'Authorization': `Bearer ${token}` });
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

  createJob(): void {
    if (!this.newJob.title) return;
    this.busy = true;
    this.message = null;
    this.http.post<Job>('/api/jobs', this.newJob, { headers: this.getHeaders() }).subscribe({
      next: (job) => {
        this.message = `Job "${job.title}" created successfully`;
        this.isError = false;
        this.busy = false;
        this.newJob = { title: '', pickup: '', dropoff: '' };
        this.loadJobs();
      },
      error: (err) => {
        console.error('Failed to create job:', err);
        this.message = `Failed to create job: ${err.error || err.statusText}`;
        this.isError = true;
        this.busy = false;
      }
    });
  }

  deleteJob(job: Job): void {
    if (!confirm(`Delete job "${job.title}"?`)) return;
    this.http.delete(`/api/jobs/${job.jobId}`, { headers: this.getHeaders() }).subscribe({
      next: () => {
        this.jobs = this.jobs.filter(j => j.jobId !== job.jobId);
      },
      error: (err) => {
        console.error('Failed to delete job:', err);
        alert(`Failed to delete job: ${err.error || err.statusText}`);
      }
    });
  }
}
