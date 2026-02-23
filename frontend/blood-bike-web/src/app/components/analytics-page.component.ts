import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, interval, switchMap, startWith, catchError, of } from 'rxjs';
import { AnalyticsService, RiderSummary, SpeedPoint } from '../services/analytics.service';
import { AuthService } from '../services/auth.service';

interface ChartPoint { x: number; y: number }

@Component({
  selector: 'app-analytics-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="analytics-page">
      <div class="analytics-header">
        <h1>📊 Analytics</h1>
        <span class="refresh-badge" *ngIf="lastRefresh()">Updated {{ lastRefresh() | date:'HH:mm:ss' }}</span>
      </div>

      <!-- Rider selector (fleet managers / dispatchers) -->
      <div class="rider-selector" *ngIf="canViewAll()">
        <label for="rider-select">Rider:</label>
        <select id="rider-select" [(ngModel)]="selectedRider" (ngModelChange)="onRiderChange()">
          <option value="">— Select a rider —</option>
          <option *ngFor="let id of riderIds()" [value]="id">{{ id }}</option>
        </select>
        <span class="hint" *ngIf="riderIds().length === 0">No riders being tracked yet</span>
      </div>

      <!-- No data message -->
      <div class="no-data" *ngIf="!selectedRider && canViewAll()">
        Select a rider above to view their analytics.
      </div>

      <!-- Loading indicator -->
      <div class="loading" *ngIf="loading() && selectedRider">Loading analytics…</div>

      <!-- Error -->
      <div class="error" *ngIf="error()">⚠️ {{ error() }}</div>

      <!-- Metrics cards -->
      <div class="metrics-grid" *ngIf="summary() && selectedRider">
        <div class="metric-card highlight">
          <div class="metric-icon">⚡</div>
          <div class="metric-value">{{ summary()!.currentSpeedKph | number:'1.0-1' }}</div>
          <div class="metric-unit">km/h</div>
          <div class="metric-label">Current Speed</div>
        </div>
        <div class="metric-card">
          <div class="metric-icon">🏎️</div>
          <div class="metric-value">{{ summary()!.topSpeedKph | number:'1.0-1' }}</div>
          <div class="metric-unit">km/h</div>
          <div class="metric-label">Top Speed</div>
        </div>
        <div class="metric-card">
          <div class="metric-icon">📈</div>
          <div class="metric-value">{{ summary()!.avgSpeedKph | number:'1.0-1' }}</div>
          <div class="metric-unit">km/h</div>
          <div class="metric-label">Avg Speed</div>
        </div>
        <div class="metric-card">
          <div class="metric-icon">📍</div>
          <div class="metric-value">{{ summary()!.totalDistanceKm | number:'1.0-2' }}</div>
          <div class="metric-unit">km</div>
          <div class="metric-label">Distance</div>
        </div>
        <div class="metric-card">
          <div class="metric-icon">⏱️</div>
          <div class="metric-value">{{ summary()!.activeTimeMinutes | number:'1.0-0' }}</div>
          <div class="metric-unit">min</div>
          <div class="metric-label">Active Time</div>
        </div>
        <div class="metric-card">
          <div class="metric-icon">📡</div>
          <div class="metric-value">{{ summary()!.dataPoints }}</div>
          <div class="metric-unit">pts</div>
          <div class="metric-label">GPS Points</div>
        </div>
      </div>

      <!-- Speed over time chart -->
      <div class="chart-card" *ngIf="summary() && selectedRider && speedHistory().length > 1">
        <h2>Speed Over Time</h2>
        <div class="chart-container">
          <svg [attr.viewBox]="'0 0 ' + chartW + ' ' + chartH" preserveAspectRatio="none" class="chart-svg">
            <defs>
              <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#dc3545" stop-opacity="0.35"/>
                <stop offset="100%" stop-color="#dc3545" stop-opacity="0.03"/>
              </linearGradient>
            </defs>
            <!-- Y-axis grid lines & labels -->
            <g *ngFor="let tick of yTicks()">
              <line [attr.x1]="labelW" [attr.y1]="tick.y" [attr.x2]="chartW - padR" [attr.y2]="tick.y"
                    stroke="#eee" stroke-width="1"/>
              <text [attr.x]="labelW - 4" [attr.y]="tick.y + 4" text-anchor="end"
                    font-size="10" fill="#999">{{ tick.label }}</text>
            </g>
            <!-- Area fill -->
            <polygon [attr.points]="areaPoints()" fill="url(#speedGrad)"/>
            <!-- Speed line -->
            <polyline [attr.points]="linePoints()" fill="none" stroke="#dc3545" stroke-width="2"
                      stroke-linejoin="round" stroke-linecap="round"/>
          </svg>
          <div class="chart-x-labels">
            <span>{{ speedHistory()[0]?.timestamp | date:'HH:mm' }}</span>
            <span>{{ speedHistory()[speedHistory().length - 1]?.timestamp | date:'HH:mm' }}</span>
          </div>
        </div>
        <div class="chart-legend">km/h over session time</div>
      </div>

      <!-- No history message -->
      <div class="empty-chart" *ngIf="summary() && selectedRider && speedHistory().length <= 1">
        <p>Not enough movement data yet to render a chart.</p>
        <p class="hint">Data appears once the rider starts moving.</p>
      </div>

      <!-- Last known position -->
      <div class="last-position" *ngIf="summary() && selectedRider && summary()!.lastLat !== 0">
        <small>📌 Last position: {{ summary()!.lastLat | number:'1.4-4' }},
          {{ summary()!.lastLng | number:'1.4-4' }}
          &nbsp;·&nbsp; {{ summary()!.lastSeen | date:'HH:mm:ss' }}</small>
      </div>
    </div>
  `,
  styles: [`
    .analytics-page {
      padding: 1rem;
      max-width: 800px;
      margin: auto;
      font-family: inherit;
    }
    .analytics-header {
      display: flex;
      align-items: baseline;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    h1 { margin: 0; font-size: 1.5rem; }
    .refresh-badge {
      font-size: .78rem;
      color: #888;
      background: #f0f0f0;
      padding: 2px 8px;
      border-radius: 12px;
    }
    .rider-selector {
      display: flex;
      align-items: center;
      gap: .75rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }
    .rider-selector label { font-weight: 600; }
    .rider-selector select {
      padding: .4rem .75rem;
      border-radius: 6px;
      border: 1px solid #ccc;
      font-size: .95rem;
      min-width: 200px;
    }
    .hint { font-size: .82rem; color: #aaa; }
    .no-data, .loading, .error {
      padding: 1.5rem;
      border-radius: 10px;
      text-align: center;
      color: #666;
      background: #fafafa;
      margin-bottom: 1rem;
    }
    .error { background: #fff3f3; color: #c00; }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: .75rem;
      margin-bottom: 1.5rem;
    }
    .metric-card {
      background: #fff;
      border: 1px solid #e8e8e8;
      border-radius: 12px;
      padding: 1rem .75rem;
      text-align: center;
      box-shadow: 0 1px 4px rgba(0,0,0,.06);
      transition: transform .15s;
    }
    .metric-card:hover { transform: translateY(-2px); }
    .metric-card.highlight {
      border-color: #dc3545;
      background: linear-gradient(135deg, #fff5f6, #fff);
    }
    .metric-icon { font-size: 1.4rem; margin-bottom: .25rem; }
    .metric-value { font-size: 1.8rem; font-weight: 700; line-height: 1; color: #222; }
    .metric-unit { font-size: .75rem; color: #999; margin-bottom: .25rem; }
    .metric-label { font-size: .78rem; color: #555; font-weight: 500; }
    .chart-card {
      background: #fff;
      border: 1px solid #e8e8e8;
      border-radius: 12px;
      padding: 1rem 1rem .75rem;
      box-shadow: 0 1px 4px rgba(0,0,0,.06);
      margin-bottom: 1rem;
    }
    .chart-card h2 { margin: 0 0 .75rem; font-size: 1rem; color: #333; }
    .chart-container { position: relative; }
    .chart-svg { width: 100%; height: 160px; display: block; overflow: visible; }
    .chart-x-labels {
      display: flex;
      justify-content: space-between;
      font-size: .72rem;
      color: #aaa;
      padding: 2px 0;
    }
    .chart-legend { text-align: center; font-size: .75rem; color: #aaa; margin-top: .25rem; }
    .empty-chart {
      background: #fafafa;
      border-radius: 10px;
      padding: 1.5rem;
      text-align: center;
      color: #888;
      margin-bottom: 1rem;
    }
    .empty-chart p { margin: .25rem 0; }
    .last-position {
      text-align: right;
      color: #aaa;
      font-size: .8rem;
      margin-top: .5rem;
    }
  `]
})
export class AnalyticsPageComponent implements OnInit, OnDestroy {
  private readonly analyticsService = inject(AnalyticsService);
  private readonly auth = inject(AuthService);

  // Chart dimensions
  readonly chartW = 560;
  readonly chartH = 140;
  readonly padTop = 10;
  readonly padBot = 20;
  readonly padR = 10;
  readonly labelW = 32;

  // State
  readonly summary = signal<RiderSummary | null>(null);
  readonly riderIds = signal<string[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly lastRefresh = signal<Date | null>(null);

  selectedRider = '';
  private pollSub?: Subscription;

  readonly canViewAll = computed(() => {
    const roles = this.auth.roles();
    return roles.some(r => ['FleetManager', 'Dispatcher', 'BloodBikeAdmin'].includes(r));
  });

  readonly speedHistory = computed(() => this.summary()?.speedHistory ?? []);

  ngOnInit(): void {
    if (this.canViewAll()) {
      // Fetch the list of tracked rider IDs and start polling if we pick a default
      this.analyticsService.getRiderIds().pipe(
        catchError(() => of([] as string[]))
      ).subscribe(ids => {
        this.riderIds.set(ids);
        if (ids.length === 1) {
          this.selectedRider = ids[0];
          this.startPolling();
        }
      });
    } else {
      // Rider sees their own data
      this.selectedRider = this.auth.username();
      this.startPolling();
    }
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  onRiderChange(): void {
    this.summary.set(null);
    this.error.set(null);
    if (this.selectedRider) {
      this.startPolling();
    } else {
      this.pollSub?.unsubscribe();
    }
  }

  private startPolling(): void {
    this.pollSub?.unsubscribe();
    if (!this.selectedRider) return;

    this.pollSub = interval(15_000).pipe(
      startWith(0),
      switchMap(() => {
        this.loading.set(true);
        return this.analyticsService.getSummary(this.selectedRider).pipe(
          catchError(err => {
            this.error.set(err?.error || 'Failed to load analytics');
            this.loading.set(false);
            return of(null);
          })
        );
      })
    ).subscribe(data => {
      if (data) {
        this.summary.set(data);
        this.error.set(null);
        this.lastRefresh.set(new Date());
      }
      this.loading.set(false);
    });
  }

  // --- Chart helpers ---

  yTicks(): Array<{ y: number; label: string }> {
    const hist = this.speedHistory();
    if (hist.length < 2) return [];
    const maxSpd = Math.max(...hist.map(p => p.speed), 10);
    const ceiling = Math.ceil(maxSpd / 20) * 20;
    const ticks: Array<{ y: number; label: string }> = [];
    for (let v = 0; v <= ceiling; v += 20) {
      ticks.push({ y: this.speedToY(v, ceiling), label: String(v) });
    }
    return ticks;
  }

  linePoints(): string {
    const hist = this.speedHistory();
    if (hist.length < 2) return '';
    const maxSpd = Math.max(...hist.map(p => p.speed), 10);
    const ceiling = Math.ceil(maxSpd / 20) * 20;
    const drawW = this.chartW - this.labelW - this.padR;
    return hist.map((p, i) => {
      const x = this.labelW + (i / (hist.length - 1)) * drawW;
      const y = this.speedToY(p.speed, ceiling);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  areaPoints(): string {
    const hist = this.speedHistory();
    if (hist.length < 2) return '';
    const maxSpd = Math.max(...hist.map(p => p.speed), 10);
    const ceiling = Math.ceil(maxSpd / 20) * 20;
    const drawW = this.chartW - this.labelW - this.padR;
    const bottom = this.chartH - this.padBot;
    const pts = hist.map((p, i) => {
      const x = this.labelW + (i / (hist.length - 1)) * drawW;
      const y = this.speedToY(p.speed, ceiling);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const firstX = this.labelW;
    const lastX = this.labelW + drawW;
    return `${firstX},${bottom} ${pts.join(' ')} ${lastX},${bottom}`;
  }

  private speedToY(speed: number, ceiling: number): number {
    const drawH = this.chartH - this.padTop - this.padBot;
    return this.padTop + drawH - (speed / ceiling) * drawH;
  }
}
