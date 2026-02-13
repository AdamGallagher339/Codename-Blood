import { Component } from '@angular/core';
import { FleetTrackerComponent } from './fleet-tracker.component';

@Component({
  selector: 'app-fleet-manager',
  standalone: true,
  imports: [FleetTrackerComponent],
  template: `
    <div class="fleet-manager-page">
      <app-fleet-tracker></app-fleet-tracker>
    </div>
  `,
  styles: [`
    .fleet-manager-page {
      min-height: calc(100vh - 80px);
    }
  `]
})
export class FleetManagerComponent {}
