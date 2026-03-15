import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, interval, switchMap, startWith, catchError, of } from 'rxjs';
import { AnalyticsService, RiderSummary, SpeedPoint, RiderOption } from '../services/analytics.service';
import { AuthService } from '../services/auth.service';
import { DashboardPageHeaderComponent, PageStat } from './dashboard-page-header.component';
import { SectionCardComponent } from './section-card.component';
import { EmptyStateComponent } from './empty-state.component';

interface ChartPoint { x: number; y: number }

@Component({
  selector: 'app-analytics-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DashboardPageHeaderComponent, SectionCardComponent, EmptyStateComponent],
  templateUrl: './analytics-page.component.html',
  styleUrls: ['./analytics-page.component.scss']
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
  readonly riders = signal<RiderOption[]>([]);
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

  // Computed properties for header stats
  readonly headerStats = computed((): PageStat[] => {
    if (!this.summary()) return [];
    const s = this.summary()!;
    return [
      {
        label: 'Current Speed',
        value: `${(s.currentSpeedKph || 0).toFixed(1)}`,
        icon: '⚡',
        color: 'red'
      },
      {
        label: 'Top Speed',
        value: `${(s.topSpeedKph || 0).toFixed(1)}`,
        icon: '🏎️',
        color: 'blue'
      },
      {
        label: 'Avg Speed',
        value: `${(s.avgSpeedKph || 0).toFixed(1)}`,
        icon: '📈',
        color: 'green'
      }
    ];
  });

  ngOnInit(): void {
    if (this.canViewAll()) {
      // Populate dropdown from the real riders list, always include self
      this.analyticsService.getRiders().pipe(
        catchError(() => of([] as RiderOption[]))
      ).subscribe(list => {
        const me = this.auth.username();
        // Ensure current user is always in the list
        if (me && !list.find(r => r.id === me)) {
          list = [{ id: me, name: me }, ...list];
        }
        this.riders.set(list);
        if (list.length === 1) {
          this.selectedRider = list[0].id;
          this.startPolling();
        }
      });
    } else {
      // Rider sees their own data — auto-select, no dropdown shown
      const me = this.auth.username();
      this.selectedRider = me;
      if (me) this.startPolling();
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
