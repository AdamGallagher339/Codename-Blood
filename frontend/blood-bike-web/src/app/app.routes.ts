import { Routes } from '@angular/router';
import { QrScannerComponent } from './components/qr-scanner.component';
import { TrackingMapComponent } from './components/tracking-map.component';
import { EventsPageComponent } from './components/events-page.component';
import { hasRoleGuard } from './guards/role.guard';
import { DispatcherComponent } from './components/dispatcher.component';
import { FleetManagerComponent } from './components/fleet-manager.component';
import { RiderJobsComponent } from './components/rider-jobs.component';
import { ActiveJobComponent } from './components/active-job.component';
import { SettingsComponent } from './components/settings.component';
import { AccessDeniedComponent } from './components/access-denied.component';
import { BlankComponent } from './components/blank.component';
import { ActiveRidersComponent } from './components/active-riders.component';
import { RiderAvailabilityComponent } from './components/rider-availability.component';
import { ApplicationsComponent } from './components/applications.component';
import { TrainingsComponent } from './components/trainings.component';

export const routes: Routes = [
  // Dashboard / Maps (available to Rider, Fleet Manager, Dispatcher)
  { path: 'tracking', component: TrackingMapComponent, canActivate: [hasRoleGuard], data: { roles: ['Rider', 'FleetManager', 'Dispatcher'] } },
  
  // QR Scanner - Rider and Fleet Manager only
  { path: 'scan', component: QrScannerComponent, canActivate: [hasRoleGuard], data: { roles: ['Rider', 'FleetManager'] } },
  
  // Dispatcher Dashboard
  { path: 'dispatcher', component: DispatcherComponent, canActivate: [hasRoleGuard], data: { roles: ['Dispatcher'] } },
  
  // Fleet Manager Dashboard
  { path: 'fleet', component: FleetManagerComponent, canActivate: [hasRoleGuard], data: { roles: ['FleetManager'] } },
  
  // Rider Jobs Page
  { path: 'jobs', component: RiderJobsComponent, canActivate: [hasRoleGuard], data: { roles: ['Rider'] } },
  
  // Active Job – delivery workflow
  { path: 'active-job', component: ActiveJobComponent, canActivate: [hasRoleGuard], data: { roles: ['Rider'] } },
  
  // Active Riders – admin, fleet manager, dispatcher
  { path: 'active-riders', component: ActiveRidersComponent, canActivate: [hasRoleGuard], data: { roles: ['BloodBikeAdmin', 'FleetManager', 'Dispatcher'] } },

  // Rider Availability – riders set their own status
  { path: 'my-availability', component: RiderAvailabilityComponent, canActivate: [hasRoleGuard], data: { roles: ['Rider'] } },

  // HR – Applications
  { path: 'applications', component: ApplicationsComponent, canActivate: [hasRoleGuard], data: { roles: ['HR'] } },

  // HR – Trainings
  { path: 'trainings', component: TrainingsComponent, canActivate: [hasRoleGuard], data: { roles: ['HR'] } },

  // Events (available to all authenticated users)
  { path: 'events', component: EventsPageComponent },
  
  // Settings (available to all authenticated users)
  { path: 'settings', component: SettingsComponent },
  
  // Access Denied page
  { path: 'access-denied', component: AccessDeniedComponent },
  
  // Blank route so the app can render inline pages on the root path.
  { path: '', component: BlankComponent },
  { path: '**', redirectTo: 'access-denied' }
];
