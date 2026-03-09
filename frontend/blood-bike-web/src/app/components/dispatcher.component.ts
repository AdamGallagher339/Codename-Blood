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
    <div class="dispatch-page">

      <!-- Create Job Card -->
      <div class="section-head">
        <span class="section-title">New Job</span>
      </div>
      <div class="create-card">
        <div class="field">
          <label class="field-label">Title</label>
          <input type="text" class="field-input" [(ngModel)]="newJob.title" placeholder="e.g. Blood sample — St James" />
        </div>

        <!-- Pickup -->
        <div class="field">
          <label class="field-label pickup-label">
            <span class="dot green"></span> Pickup
          </label>
          <div class="input-row">
            <input type="text" class="field-input" [(ngModel)]="newJob.pickup" placeholder="Pickup address" />
            <button class="btn-pin" [class.active]="showPickupMap" (click)="togglePickupMap()">📍</button>
          </div>
        </div>
        <div *ngIf="showPickupMap" id="dispatcher-pickup-map" class="map-embed"></div>
        <div *ngIf="newJob.pickupLat !== null" class="pin-tag green">
          📌 {{ newJob.pickupLat?.toFixed(5) }}, {{ newJob.pickupLng?.toFixed(5) }}
          <button class="tag-clear" (click)="clearPickupPin()">✕</button>
        </div>

        <!-- Dropoff -->
        <div class="field">
          <label class="field-label dropoff-label">
            <span class="dot red"></span> Delivery
          </label>
          <div class="input-row">
            <input type="text" class="field-input" [(ngModel)]="newJob.dropoff" placeholder="Delivery address" />
            <button class="btn-pin red" [class.active]="showDropoffMap" (click)="toggleDropoffMap()">📍</button>
          </div>
        </div>
        <div *ngIf="showDropoffMap" id="dispatcher-dropoff-map" class="map-embed"></div>
        <div *ngIf="newJob.dropoffLat !== null" class="pin-tag red">
          📌 {{ newJob.dropoffLat?.toFixed(5) }}, {{ newJob.dropoffLng?.toFixed(5) }}
          <button class="tag-clear" (click)="clearDropoffPin()">✕</button>
        </div>

        <button class="btn-create" (click)="createJob()" [disabled]="busy || !newJob.title">
          {{ busy ? 'Creating…' : 'Create Job' }}
        </button>

        <div *ngIf="message" class="toast" [class.error]="isError">{{ message }}</div>
      </div>

      <!-- Jobs List -->
      <div class="section-head">
        <span class="section-title">All Jobs</span>
        <button class="btn-refresh" (click)="loadJobs()" [disabled]="loading">
          {{ loading ? '...' : '↻' }}
        </button>
      </div>

      <div *ngIf="loading" class="loading-state">
        <div class="loader"></div>
      </div>

      <div *ngIf="!loading && jobs.length === 0" class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-text">No jobs created yet</div>
      </div>

      <div class="job-list" *ngIf="!loading">
        <div class="job-card" *ngFor="let j of jobs">
          <div class="job-card-head">
            <span class="jc-title">{{ j.title }}</span>
            <span class="status-pill" [class]="'s-' + j.status">{{ j.status }}</span>
          </div>
          <div class="job-route">
            <div class="rp pickup">
              <span class="rp-dot"></span>
              <span class="rp-addr">{{ j.pickup?.address || '—' }}</span>
            </div>
            <div class="rp-line"></div>
            <div class="rp dropoff">
              <span class="rp-dot"></span>
              <span class="rp-addr">{{ j.dropoff?.address || '—' }}</span>
            </div>
          </div>
          <div class="job-card-meta">
            <div class="meta-chips">
              <span class="meta-chip" *ngIf="j.createdBy">By {{ j.createdBy }}</span>
              <span class="meta-chip" *ngIf="j.acceptedBy">→ {{ j.acceptedBy }}</span>
              <span class="meta-chip">{{ j.timestamps?.created | date:'short' }}</span>
            </div>
            <button class="btn-del" (click)="deleteJob(j)">🗑</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dispatch-page {
      padding: 1rem;
      max-width: 520px;
      margin: 0 auto;
    }

    /* ── Section Heads ── */
    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
      margin-top: 1.25rem;
    }
    .section-head:first-child { margin-top: 0; }
    .section-title {
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #888;
    }

    /* ── Create Card ── */
    .create-card {
      background: #1a1a1a;
      border-radius: 16px;
      border: 1px solid #2a2a2a;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .field-label {
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #777;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .dot.green { background: #4ade80; }
    .dot.red { background: var(--color-red, #dc143c); }
    .field-input {
      padding: 10px 12px;
      background: #111;
      border: 1.5px solid #333;
      border-radius: 10px;
      color: #eee;
      font-size: 0.95rem;
      transition: border-color 0.15s;
    }
    .field-input::placeholder { color: #555; }
    .field-input:focus {
      outline: none;
      border-color: var(--color-red, #dc143c);
      box-shadow: 0 0 0 3px rgba(220,20,60,0.15);
    }
    .input-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .input-row .field-input { flex: 1; }

    /* ── Pin Button ── */
    .btn-pin {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      border: 1.5px solid #333;
      background: #111;
      font-size: 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      flex-shrink: 0;
      -webkit-tap-highlight-color: transparent;
    }
    .btn-pin:hover, .btn-pin.active { border-color: #4ade80; background: #0a1f14; }
    .btn-pin.red:hover, .btn-pin.red.active { border-color: var(--color-red, #dc143c); background: #1f0a0e; }

    /* ── Map Embed ── */
    .map-embed {
      height: 240px;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #333;
    }

    /* ── Pin Tag ── */
    .pin-tag {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .pin-tag.green { background: #0d3320; color: #bbf7d0; }
    .pin-tag.red { background: #3b0a0a; color: #fecaca; }
    .tag-clear {
      background: none;
      border: none;
      cursor: pointer;
      color: inherit;
      opacity: 0.6;
      font-size: 0.85rem;
      margin-left: auto;
    }
    .tag-clear:hover { opacity: 1; }

    /* ── Create Button ── */
    .btn-create {
      width: 100%;
      padding: 14px;
      border-radius: 14px;
      border: none;
      background: var(--color-red, #dc143c);
      color: #fff;
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.15s;
      -webkit-tap-highlight-color: transparent;
    }
    .btn-create:hover:not(:disabled) { background: #b01030; }
    .btn-create:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ── Toast ── */
    .toast {
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 500;
      text-align: center;
      background: #14532d;
      color: #bbf7d0;
      animation: toast-in 0.3s ease;
    }
    .toast.error { background: #7f1d1d; color: #fecaca; }
    @keyframes toast-in {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ── Refresh button ── */
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
    .loading-state { display: flex; justify-content: center; padding: 2rem 0; }
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
    .empty-state { text-align: center; padding: 2rem 1rem; color: #666; }
    .empty-icon { font-size: 2rem; margin-bottom: 0.5rem; }
    .empty-text { font-size: 0.9rem; }

    /* ── Job Cards ── */
    .job-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .job-card {
      background: #1a1a1a;
      border-radius: 14px;
      padding: 14px 16px;
      border: 1px solid #2a2a2a;
    }
    .job-card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .jc-title { font-weight: 700; font-size: 1rem; color: #fff; }
    .status-pill {
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      flex-shrink: 0;
    }
    .s-open { background: #78350f; color: #fde68a; }
    .s-accepted { background: #1e3a5f; color: #93c5fd; }
    .s-picked-up { background: #713f12; color: #fde68a; }
    .s-delivered, .s-completed { background: #14532d; color: #bbf7d0; }
    .s-cancelled { background: #7f1d1d; color: #fecaca; }

    /* ── Route Viz ── */
    .job-route {
      display: flex;
      flex-direction: column;
      padding-left: 4px;
      margin-bottom: 10px;
    }
    .rp { display: flex; align-items: center; gap: 10px; }
    .rp-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .pickup .rp-dot { background: #4ade80; }
    .dropoff .rp-dot { background: var(--color-red, #dc143c); }
    .rp-addr { font-size: 0.85rem; color: #bbb; }
    .rp-line { width: 2px; height: 14px; background: #333; margin-left: 4px; }

    /* ── Meta ── */
    .job-card-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .meta-chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .meta-chip {
      font-size: 0.72rem;
      color: #666;
      background: #222;
      padding: 2px 8px;
      border-radius: 8px;
    }
    .btn-del {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: 1px solid #333;
      background: transparent;
      cursor: pointer;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      -webkit-tap-highlight-color: transparent;
    }
    .btn-del:hover { background: #7f1d1d; border-color: #991b1b; }
  `]
})
export class DispatcherComponent implements OnInit, OnDestroy {
  newJob: { title: string; pickup: string; dropoff: string; pickupLat: number | null; pickupLng: number | null; dropoffLat: number | null; dropoffLng: number | null } =
    { title: '', pickup: '', dropoff: '', pickupLat: null, pickupLng: null, dropoffLat: null, dropoffLng: null };
  showPickupMap = false;
  showDropoffMap = false;
  private pickupMap: L.Map | null = null;
  private pickupMarker: L.Marker | null = null;
  private dropoffMap: L.Map | null = null;
  private dropoffMarker: L.Marker | null = null;
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
    this.destroyDropoffMap();
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

  toggleDropoffMap(): void {
    if (this.showDropoffMap) {
      this.showDropoffMap = false;
      this.destroyDropoffMap();
    } else {
      this.showDropoffMap = true;
      setTimeout(() => this.initDropoffMap(), 50);
    }
  }

  clearDropoffPin(): void {
    this.newJob.dropoffLat = null;
    this.newJob.dropoffLng = null;
    if (this.dropoffMarker) { this.dropoffMarker.remove(); this.dropoffMarker = null; }
  }

  private initDropoffMap(): void {
    const container = document.getElementById('dispatcher-dropoff-map');
    if (!container || this.dropoffMap) return;
    const lat = this.newJob.dropoffLat ?? this.newJob.pickupLat ?? 53.2707;
    const lng = this.newJob.dropoffLng ?? this.newJob.pickupLng ?? -9.0568;
    this.dropoffMap = L.map('dispatcher-dropoff-map', { zoomControl: true }).setView([lat, lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 18
    }).addTo(this.dropoffMap);
    if (this.newJob.dropoffLat !== null && this.newJob.dropoffLng !== null) {
      this.placeDropoffMarker(this.newJob.dropoffLat, this.newJob.dropoffLng);
    }
    this.dropoffMap.on('click', (e: L.LeafletMouseEvent) => {
      this.newJob.dropoffLat = parseFloat(e.latlng.lat.toFixed(6));
      this.newJob.dropoffLng = parseFloat(e.latlng.lng.toFixed(6));
      this.placeDropoffMarker(e.latlng.lat, e.latlng.lng);
    });
  }

  private placeDropoffMarker(lat: number, lng: number): void {
    if (!this.dropoffMap) return;
    const redIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });
    if (this.dropoffMarker) {
      this.dropoffMarker.setLatLng([lat, lng]);
    } else {
      this.dropoffMarker = L.marker([lat, lng], { icon: redIcon }).addTo(this.dropoffMap);
    }
  }

  private destroyDropoffMap(): void {
    if (this.dropoffMarker) { this.dropoffMarker.remove(); this.dropoffMarker = null; }
    if (this.dropoffMap) { this.dropoffMap.remove(); this.dropoffMap = null; }
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
        this.newJob = { title: '', pickup: '', dropoff: '', pickupLat: null, pickupLng: null, dropoffLat: null, dropoffLng: null };
        this.showPickupMap = false;
        this.showDropoffMap = false;
        this.destroyPickupMap();
        this.destroyDropoffMap();
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
