import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface PageStat {
  label: string;
  value: string | number;
  icon?: string;
  color?: 'red' | 'blue' | 'green' | 'yellow' | 'gray';
}

@Component({
  selector: 'app-dashboard-page-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-page-header">
      <div class="header-content">
        <div class="header-title-section">
          <h1 class="header-title">{{ title }}</h1>
          <p class="header-subtitle" *ngIf="subtitle">{{ subtitle }}</p>
        </div>
        
        <ng-content select="[headerActions]"></ng-content>
      </div>

      <!-- Stats Row -->
      <div class="header-stats" *ngIf="stats && stats.length > 0">
        <div class="stat-item" *ngFor="let stat of stats" [class]="'stat-' + (stat.color || 'gray')">
          <span class="stat-icon" *ngIf="stat.icon">{{ stat.icon }}</span>
          <div class="stat-content">
            <div class="stat-label">{{ stat.label }}</div>
            <div class="stat-value">{{ stat.value }}</div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-page-header {
      background: var(--color-white);
      border-bottom: 1px solid #e5e7eb;
      box-shadow: var(--shadow-sm);
      padding: 0;
      flex-shrink: 0;
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--spacing-lg);
      padding: var(--spacing-lg);
      flex-wrap: wrap;
    }

    .header-title-section {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
    }

    .header-title {
      font-size: var(--font-size-2xl);
      font-weight: 700;
      color: var(--color-text-dark);
      margin: 0;
      line-height: 1.2;
    }

    .header-subtitle {
      font-size: var(--font-size-sm);
      color: #888;
      margin: 0;
      font-weight: 500;
    }

    .header-stats {
      display: flex;
      gap: var(--spacing-lg);
      padding: 0 var(--spacing-lg) var(--spacing-lg);
      flex-wrap: wrap;
      border-top: 1px solid #f0f0f0;
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      min-width: 160px;
    }

    .stat-icon {
      font-size: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: var(--border-radius-md);
    }

    .stat-red .stat-icon {
      background: rgba(220, 20, 60, 0.1);
      color: var(--color-red);
    }

    .stat-blue .stat-icon {
      background: rgba(59, 130, 246, 0.1);
      color: #3b82f6;
    }

    .stat-green .stat-icon {
      background: rgba(34, 197, 94, 0.1);
      color: #22c55e;
    }

    .stat-yellow .stat-icon {
      background: rgba(234, 179, 8, 0.1);
      color: #eab308;
    }

    .stat-gray .stat-icon {
      background: #f0f0f0;
      color: #888;
    }

    .stat-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .stat-label {
      font-size: var(--font-size-xs);
      color: #888;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .stat-value {
      font-size: var(--font-size-lg);
      font-weight: 700;
      color: var(--color-text-dark);
    }

    @media (max-width: 768px) {
      .header-content {
        padding: var(--spacing-md);
      }

      .header-title {
        font-size: var(--font-size-xl);
      }

      .header-stats {
        padding: 0 var(--spacing-md) var(--spacing-md);
        gap: var(--spacing-md);
      }

      .stat-item {
        min-width: 140px;
      }
    }

    @media (max-width: 480px) {
      .header-content {
        padding: var(--spacing-sm);
        gap: var(--spacing-sm);
      }

      .header-title {
        font-size: var(--font-size-lg);
      }

      .header-subtitle {
        font-size: 11px;
      }

      .header-stats {
        padding: 0 var(--spacing-sm) var(--spacing-sm);
        gap: var(--spacing-sm);
      }

      .stat-item {
        min-width: auto;
        flex: 1;
      }

      .stat-icon {
        width: 36px;
        height: 36px;
        font-size: 1.25rem;
      }

      .stat-label {
        font-size: 9px;
      }

      .stat-value {
        font-size: var(--font-size-base);
      }
    }
  `]
})
export class DashboardPageHeaderComponent {
  @Input() title: string = '';
  @Input() subtitle?: string;
  @Input() stats?: PageStat[];
}
