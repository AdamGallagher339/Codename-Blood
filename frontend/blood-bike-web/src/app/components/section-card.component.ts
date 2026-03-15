import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-section-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="section-card">
      <div class="section-header" *ngIf="title || headerAction">
        <h3 class="section-title">{{ title }}</h3>
        <ng-content select="[sectionAction]"></ng-content>
      </div>

      <div class="section-content">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .section-card {
      background: var(--color-white);
      border: 1px solid #e5e7eb;
      border-radius: var(--border-radius-lg);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
      transition: all var(--transition-fast);

      &:hover {
        box-shadow: var(--shadow-md);
      }
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--spacing-lg);
      border-bottom: 1px solid #f0f0f0;
      background: #fafafa;
      gap: var(--spacing-md);
    }

    .section-title {
      font-size: var(--font-size-lg);
      font-weight: 700;
      color: var(--color-text-dark);
      margin: 0;
    }

    .section-content {
      padding: var(--spacing-lg);
    }

    @media (max-width: 768px) {
      .section-header {
        padding: var(--spacing-md);
      }

      .section-title {
        font-size: var(--font-size-base);
      }

      .section-content {
        padding: var(--spacing-md);
      }
    }

    @media (max-width: 480px) {
      .section-header {
        padding: var(--spacing-sm);
        flex-direction: column;
        align-items: flex-start;
        gap: var(--spacing-sm);
      }

      .section-title {
        font-size: var(--font-size-sm);
      }

      .section-content {
        padding: var(--spacing-sm);
      }
    }
  `]
})
export class SectionCardComponent {
  @Input() title?: string;
  @Input() headerAction = false;
}
