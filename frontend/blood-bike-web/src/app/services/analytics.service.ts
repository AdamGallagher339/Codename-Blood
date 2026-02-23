import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SpeedPoint {
  timestamp: string;
  speed: number;
  lat: number;
  lng: number;
}

export interface RiderSummary {
  riderId: string;
  topSpeedKph: number;
  avgSpeedKph: number;
  totalDistanceKm: number;
  activeTimeMinutes: number;
  currentSpeedKph: number;
  lastLat: number;
  lastLng: number;
  lastSeen: string;
  speedHistory: SpeedPoint[];
  dataPoints: number;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);

  /** Returns analytics summary + speed history for a specific rider. */
  getSummary(riderId: string): Observable<RiderSummary> {
    return this.http.get<RiderSummary>(`/api/analytics/${riderId}`);
  }

  /** Returns the list of rider IDs currently tracked (fleet_manager/dispatcher only). */
  getRiderIds(): Observable<string[]> {
    return this.http.get<string[]>('/api/analytics/');
  }
}
