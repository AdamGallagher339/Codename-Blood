import { Routes } from '@angular/router';
import { QrScannerComponent } from './components/qr-scanner.component';
import { TrackingMapComponent } from './components/tracking-map.component';

export const routes: Routes = [
  { path: 'scan', component: QrScannerComponent },
  { path: 'tracking', component: TrackingMapComponent },
  { path: '', redirectTo: 'tracking', pathMatch: 'full' }
];
