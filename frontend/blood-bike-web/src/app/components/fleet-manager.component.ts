import { Component } from '@angular/core';
import { FleetTrackerComponent } from './fleet-tracker.component';

@Component({
  selector: 'app-fleet-manager',
  standalone: true,
  imports: [FleetTrackerComponent],
  template: `
    <div class="fleet-page-shell">
      <header class="fleet-page-header">
        <h1>Fleet</h1>
        <p>Manage vehicles, maintenance records, and operational readiness.</p>
      </header>

      <app-fleet-tracker></app-fleet-tracker>
    </div>
  `,
  styles: [`
    .fleet-page-shell {
      min-height: calc(100vh - 80px);
      background: #f8f9fa;
      padding: var(--spacing-lg);
      display: grid;
      gap: var(--spacing-md);
    }

    .fleet-page-header {
      max-width: 1400px;
      width: 100%;
      margin: 0 auto;
      background: var(--color-white);
      border: 1px solid #e5e7eb;
      border-radius: var(--border-radius-lg);
      box-shadow: var(--shadow-sm);
      padding: var(--spacing-lg);
    }

    .fleet-page-header h1 {
      margin: 0 0 4px;
      font-size: var(--font-size-2xl);
      color: var(--color-text-dark);
    }

    .fleet-page-header p {
      margin: 0;
      color: #7a7a7a;
      font-size: var(--font-size-sm);
      font-weight: 500;
    }

    @media (max-width: 768px) {
      .fleet-page-shell {
        padding: var(--spacing-md);
      }
    }
  `]
})
export class FleetManagerComponent {}
