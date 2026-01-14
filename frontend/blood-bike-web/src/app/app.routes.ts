import { Routes } from '@angular/router';
import { QrScannerComponent } from './components/qr-scanner.component';

export const routes: Routes = [
  { path: 'scan', component: QrScannerComponent },
  { path: '', redirectTo: '', pathMatch: 'full' }
];
