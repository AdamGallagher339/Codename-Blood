import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type StatCardColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'gray';

@Component({
  selector: 'app-summary-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="summary-stat-card" [class]="'card-' + (color || 'gray')">
      <div class="card-header">
        <span class="card-icon" *ngIf="icon">{{ icon }}</span>
        <h3 class="card-title">{{ title }}</h3>
      </div>

      <div class="card-value-section">
        <div class="card-value">{{ value }}</div>
        <div class="card-unit" *ngIf="unit">{{ unit }}</div>
      </div>

      <div class="card-footer" *ngIf="trend || subtitle">
        <span class="card-trend" *ngIf="trend" [class]="'trend-' + trendDirection">
          {{ trendIcon }} {{ trend }}
        </span>
        <span class="card-subtitle" *ngIf="subtitle">{{ subtitle }}</span>
      </div>

      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    .summary-stat-card {
      background: var(--color-white);
      border: 1px solid #e5e7eb;
      border-radius: var(--border-radius-lg);
      padding: var(--spacing-lg);
      transition: all var(--transition-fast);
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
      position: relative;
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: currentColor;
        opacity: 0;
        transition: opacity var(--transition-fast);
      }

      &:hover {
        transform: translateY(-4px);
        box-shadow: var(--shadow-md);

        &::before {
          opacity: 1;
        }
      }
    }

    .card-red {
      color: var(--color-red);

      .card-icon {
        background: rgba(220, 20, 60, 0.1);
      }
    }

    .card-blue {
      color: #3b82f6;

      .card-icon {
        background: rgba(59, 130, 246, 0.1);
      }
    }

    .card-green {
      color: #22c55e;

      .card-icon {
        background: rgba(34, 197, 94, 0.1);
      }
    }

    .card-yellow {
      color: #eab308;

      .card-icon {
        background: rgba(234, 179, 8, 0.1);
      }
    }

    .card-purple {
      color: #a855f7;

      .card-icon {
        background: rgba(168, 85, 247, 0.1);
      }
    }

    .card-gray {
      color: #888;

      .card-icon {
        background: #f0f0f0;
      }
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }

    .card-icon {
      font-size: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: var(--border-radius-md);
      color: inherit;
    }

    .card-title {
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: #666;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .card-value-section {
      display: flex;
      align-items: baseline;
      gap: var(--spacing-xs);
    }

    .card-value {
      font-size: var(--font-size-2xl);
      font-weight: 700;
      color: var(--color-text-dark);
      line-height: 1;
    }

    .card-unit {
      font-size: var(--font-size-xs);
      color: #888;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--spacing-sm);
      font-size: var(--font-size-xs);
      color: #666;
    }

    .card-trend {
      font-weight: 600;

      &.trend-up {
        color: #22c55e;
      }

      &.trend-down {
        color: var(--color-red);
      }

      &.trend-neutral {
        color: #888;
      }
    }

    .card-subtitle {
      flex-shrink: 0;
      white-space: nowrap;
    }

    @media (max-width: 768px) {
      .summary-stat-card {
        padding: var(--spacing-md);
        gap: var(--spacing-sm);
      }

      .card-value {
        font-size: var(--font-size-xl);
      }

      .card-icon {
        width: 36px;
        height: 36px;
        font-size: 1.25rem;
      }
    }

    @media (max-width: 480px) {
      .summary-stat-card {
        padding: var(--spacing-sm);
      }

      .card-title {
        font-size: 10px;
      }

      .card-value {
        font-size: var(--font-size-lg);
      }

      .card-unit {
        font-size: 9px;
      }

      .card-icon {
        width: 32px;
        height: 32px;
        font-size: 1rem;
      }
    }
  `]
})
export class SummaryStatCardComponent {
  @Input() title: string = '';
  @Input() value: string | number = '';
  @Input() unit?: string;
  @Input() icon?: string;
  @Input() color?: StatCardColor;
  @Input() trend?: string;
  @Input() trendDirection: 'up' | 'down' | 'neutral' = 'neutral';
  @Input() subtitle?: string;

  get trendIcon(): string {
    if (this.trendDirection === 'up') return '↑';
    if (this.trendDirection === 'down') return '↓';
    return '→';
  }
}
