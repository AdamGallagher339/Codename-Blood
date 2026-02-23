import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import * as L from 'leaflet';

interface Job {
  jobId: string;
  title: string;
  status: string;
  createdBy: string;
  acceptedBy: string;
  pickup: { address?: string; lat?: number; lng?: number };
  dropoff: { address?: string; lat?: number; lng?: number };
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
            <div class="input-with-pin">
              <input type="text" [(ngModel)]="newJob.pickup" placeholder="Pickup location" />
              <button type="button" class="btn-pin" (click)="togglePickupMap()">📍 {{ showPickupMap ? 'Close Map' : 'Pin' }}</button>
            </div>
          </label>
          <div *ngIf="showPickupMap" id="dispatcher-pickup-map" class="job-map-picker"></div>
          <p *ngIf="newJob.pickupLat !== null" class="pin-coords">📌 {{ newJob.pickupLat?.toFixed(5) }}, {{ newJob.pickupLng?.toFixed(5) }}
            <button type="button" class="btn-clear-pin" (click)="clearPickupPin()">✕ clear</button>
          </p>
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
    .input-with-pin { display: flex; gap: .5rem; align-items: center; }
    .input-with-pin input { flex: 1; }
    .btn-pin { padding: .45rem .9rem; background: #4caf50; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; white-space: nowrap; }
    .btn-pin:hover { background: #388e3c; }
    .btn-clear-pin { background: none; border: none; cursor: pointer; color: #c62828; font-size: .85rem; margin-left: .5rem; }
    .job-map-picker { height: 280px; border-radius: 8px; overflow: hidden; margin-top: .25rem; border: 1px solid #ddd; }
    .pin-coords { margin: .25rem 0 0; font-size: .85rem; color: #2e7d32; font-weight: 600; }
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
export class DispatcherComponent implements OnInit, OnDestroy {
  newJob: { title: string; pickup: string; dropoff: string; pickupLat: number | null; pickupLng: number | null } =
    { title: '', pickup: '', dropoff: '', pickupLat: null, pickupLng: null };
  showPickupMap = false;
  private pickupMap: L.Map | null = null;
  private pickupMarker: L.Marker | null = null;
  busy = false;
  loading = false;
  message: string | null = null;
  isError = false;
  jobs: Job[] = [];

  constructor(private http: HttpClient, private auth: AuthService) {}

  ngOnInit(): void {
    this.loadJobs();
  }

  ngOnDestroy(): void {
    this.destroyPickupMap();
  }

  togglePickupMap(): void {
    if (this.showPickupMap) {
      this.showPickupMap = false;
      this.destroyPickupMap();
    } else {
      this.showPickupMap = true;
      setTimeout(() => this.initPickupMap(), 50);
    }
  }

  clearPickupPin(): void {
    this.newJob.pickupLat = null;
    this.newJob.pickupLng = null;
    if (this.pickupMarker) {
      this.pickupMarker.remove();
      this.pickupMarker = null;
    }
  }

  private initPickupMap(): void {
    const container = document.getElementById('dispatcher-pickup-map');
    if (!container || this.pickupMap) return;
    const lat = this.newJob.pickupLat ?? 53.2707;
    const lng = this.newJob.pickupLng ?? -9.0568;
    this.pickupMap = L.map('dispatcher-pickup-map', { zoomControl: true }).setView([lat, lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 18
    }).addTo(this.pickupMap);
    if (this.newJob.pickupLat !== null && this.newJob.pickupLng !== null) {
      this.placePickupMarker(this.newJob.pickupLat, this.newJob.pickupLng);
    }
    this.pickupMap.on('click', (e: L.LeafletMouseEvent) => {
      this.newJob.pickupLat = parseFloat(e.latlng.lat.toFixed(6));
      this.newJob.pickupLng = parseFloat(e.latlng.lng.toFixed(6));
      this.placePickupMarker(e.latlng.lat, e.latlng.lng);
    });
  }

  private placePickupMarker(lat: number, lng: number): void {
    if (!this.pickupMap) return;
    const greenIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });
    if (this.pickupMarker) {
      this.pickupMarker.setLatLng([lat, lng]);
    } else {
      this.pickupMarker = L.marker([lat, lng], { icon: greenIcon }).addTo(this.pickupMap);
    }
  }

  private destroyPickupMap(): void {
    if (this.pickupMarker) { this.pickupMarker.remove(); this.pickupMarker = null; }
    if (this.pickupMap) { this.pickupMap.remove(); this.pickupMap = null; }
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
        this.newJob = { title: '', pickup: '', dropoff: '', pickupLat: null, pickupLng: null };
        this.showPickupMap = false;
        this.destroyPickupMap();
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
