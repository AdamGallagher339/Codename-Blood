import { Component } from '@angular/core';
import { FleetTrackerComponent } from './fleet-tracker.component';

@Component({
  selector: 'app-fleet-manager',
  standalone: true,
  imports: [FleetTrackerComponent],
  template: `
    <div class="page-container">
      <h1>Fleet Manager Dashboard</h1>
      <p>Register vehicles, manage status, and track service history.</p>
      <app-fleet-tracker></app-fleet-tracker>
    </div>
  `,
  styles: [`
    .page-container {
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }
  `]
})
export class FleetManagerComponent {}
