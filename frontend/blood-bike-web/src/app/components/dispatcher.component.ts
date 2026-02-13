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
    <div class="page-container">
      <h1>Dispatcher Dashboard</h1>
      <p>Create new jobs, view available riders, and manage delivery runs.</p>
      
      <section class="section">
        <h2>Create New Job</h2>
        <div>
          <div>
            <label>Job Title:</label>
            <input type="text" [(ngModel)]="newJob.title" placeholder="Enter job title" />
          </div>
          <div>
            <label>Pickup Address:</label>
            <input type="text" [(ngModel)]="newJob.pickup" placeholder="Pickup location" />
          </div>
          <div>
            <label>Delivery Address:</label>
            <input type="text" [(ngModel)]="newJob.dropoff" placeholder="Delivery location" />
          </div>
          <button (click)="createJob()" [disabled]="busy || !newJob.title">{{ busy ? 'Creating…' : 'Create Job' }}</button>
          <p *ngIf="message" class="message" [class.error]="isError">{{ message }}</p>
        </div>
      </section>

      <section class="section">
        <h2>All Jobs</h2>
        <button (click)="loadJobs()" [disabled]="loading" class="reload-btn">{{ loading ? 'Loading…' : '↻ Reload' }}</button>
        <div *ngIf="loading">Loading…</div>
        <table *ngIf="!loading">
          <thead>
            <tr>
              <th>Title</th>
              <th>Pickup</th>
              <th>Delivery</th>
              <th>Status</th>
              <th>Created By</th>
              <th>Accepted By</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngIf="jobs.length === 0">
              <td colspan="8">No jobs yet</td>
            </tr>
            <tr *ngFor="let j of jobs">
              <td>{{ j.title }}</td>
              <td>{{ j.pickup?.address }}</td>
              <td>{{ j.dropoff?.address }}</td>
              <td><span class="status-badge" [class]="'status-' + j.status">{{ j.status }}</span></td>
              <td>{{ j.createdBy }}</td>
              <td>{{ j.acceptedBy || '—' }}</td>
              <td>{{ j.timestamps?.created | date:'short' }}</td>
              <td><button (click)="deleteJob(j)" class="delete-btn">Delete</button></td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  `,
  styles: [`
    .page-container { padding: 20px; max-width: 1200px; margin: 0 auto; }
    .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 4px; }
    form div { margin: 10px 0; }
    label { display: block; font-weight: bold; margin-bottom: 5px; }
    input { width: 100%; padding: 8px; box-sizing: border-box; }
    button { padding: 8px 16px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px; }
    button:hover { background-color: #0056b3; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .reload-btn { background: #4CAF50; margin-bottom: 10px; }
    .delete-btn { background: #d32f2f; margin: 0; padding: 4px 10px; }
    .message { margin-top: 10px; padding: 8px; border-radius: 4px; background: #e8f5e9; color: #2e7d32; }
    .message.error { background: #ffebee; color: #c62828; }
    .status-badge { padding: 3px 8px; border-radius: 12px; font-size: 0.85em; font-weight: 500; }
    .status-open { background: #fff3e0; color: #e65100; }
    .status-accepted { background: #e3f2fd; color: #1565c0; }
    .status-completed { background: #e8f5e9; color: #2e7d32; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
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
