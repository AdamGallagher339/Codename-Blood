import { Routes } from '@angular/router';
import { QrScannerComponent } from './components/qr-scanner.component';
import { TrackingMapComponent } from './components/tracking-map.component';
import { EventsPageComponent } from './components/events-page.component';
import { hasRoleGuard } from './guards/role.guard';
import { DispatcherComponent } from './components/dispatcher.component';
import { FleetManagerComponent } from './components/fleet-manager.component';
import { RiderJobsComponent } from './components/rider-jobs.component';
import { SettingsComponent } from './components/settings.component';
import { CommunityEventsComponent } from './components/community-events.component';
import { AccessDeniedComponent } from './components/access-denied.component';

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
  
  // Events (available to all authenticated users)
  { path: 'events', component: EventsPageComponent },
  
  // Community Events (available to all authenticated users)
  { path: 'community-events', component: CommunityEventsComponent },
  
  // Settings (available to all authenticated users)
  { path: 'settings', component: SettingsComponent },
  
  // Access Denied page
  { path: 'access-denied', component: AccessDeniedComponent },
  
  // Default redirect
  { path: '', redirectTo: 'tracking', pathMatch: 'full' },
  { path: '**', redirectTo: 'access-denied' }
];
