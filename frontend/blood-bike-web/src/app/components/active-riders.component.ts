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
    <div class="page-container">
      <h1>Active Riders</h1>
      <button (click)="load()" [disabled]="loading" class="reload-btn">{{ loading ? 'Loading…' : '↻ Reload' }}</button>

      <section class="section">
        <h2>Available</h2>
        <div *ngIf="available.length === 0" class="empty">No riders currently available</div>
        <div *ngFor="let r of available" class="rider-card available">
          <span class="dot green"></span>
          <div class="info">
            <strong>{{ r.name || r.riderId }}</strong>
            <span *ngIf="r.availableUntil" class="until">until {{ r.availableUntil | date:'short' }}</span>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>On a Job</h2>
        <div *ngIf="onJob.length === 0" class="empty">No riders currently on a job</div>
        <div *ngFor="let r of onJob" class="rider-card on-job">
          <span class="dot orange"></span>
          <div class="info">
            <strong>{{ r.name || r.riderId }}</strong>
            <span class="job-id">Job: {{ jobTitles[r.currentJobId] || r.currentJobId }}</span>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>Offline</h2>
        <div *ngIf="offline.length === 0" class="empty">No offline riders</div>
        <div *ngFor="let r of offline" class="rider-card offline">
          <span class="dot grey"></span>
          <div class="info">
            <strong>{{ r.name || r.riderId }}</strong>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .page-container { padding: 1rem; max-width: 700px; margin: auto; }
    .section { margin-top: 1.5rem; }
    .reload-btn { margin-bottom: 1rem; padding: .4rem 1rem; border-radius: 6px; border: 1px solid #ccc; cursor: pointer; }
    .rider-card { display: flex; align-items: center; gap: .75rem; padding: .75rem 1rem; border-radius: 8px; margin-bottom: .5rem; background: #f5f5f5; }
    .rider-card.available { border-left: 4px solid #4caf50; }
    .rider-card.on-job { border-left: 4px solid #ff9800; }
    .rider-card.offline { border-left: 4px solid #9e9e9e; opacity: .7; }
    .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .dot.green { background: #4caf50; }
    .dot.orange { background: #ff9800; }
    .dot.grey { background: #9e9e9e; }
    .info { display: flex; flex-direction: column; }
    .until, .job-id { font-size: .85rem; color: #666; }
    .empty { color: #999; font-style: italic; }
    h2 { margin-bottom: .5rem; font-size: 1.1rem; }
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
