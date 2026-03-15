import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="empty-state">
      <div class="empty-icon" *ngIf="icon">{{ icon }}</div>
      <h3 class="empty-title">{{ title }}</h3>
      <p class="empty-message" *ngIf="message">{{ message }}</p>
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: var(--spacing-3xl) var(--spacing-lg);
      border: 2px dashed #e5e7eb;
      border-radius: var(--border-radius-lg);
      background: #fafafa;
      min-height: 200px;
      gap: var(--spacing-md);
    }

    .empty-icon {
      font-size: 3rem;
      opacity: 0.7;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .empty-title {
      font-size: var(--font-size-lg);
      font-weight: 700;
      color: var(--color-text-dark);
      margin: 0;
    }

    .empty-message {
      font-size: var(--font-size-sm);
      color: #888;
      margin: 0;
      max-width: 400px;
    }

    @media (max-width: 768px) {
      .empty-state {
        padding: var(--spacing-2xl) var(--spacing-md);
        min-height: 160px;
      }

      .empty-icon {
        font-size: 2.5rem;
      }

      .empty-title {
        font-size: var(--font-size-base);
      }

      .empty-message {
        font-size: var(--font-size-xs);
      }
    }

    @media (max-width: 480px) {
      .empty-state {
        padding: var(--spacing-xl) var(--spacing-sm);
        min-height: 140px;
      }

      .empty-icon {
        font-size: 2rem;
      }

      .empty-title {
        font-size: var(--font-size-sm);
      }

      .empty-message {
        font-size: 11px;
      }
    }
  `]
})
export class EmptyStateComponent {
  @Input() icon?: string;
  @Input() title: string = 'No data';
  @Input() message?: string;
}
