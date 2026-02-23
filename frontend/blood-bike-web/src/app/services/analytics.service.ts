import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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

export interface RiderOption {
  id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);

  /** Returns analytics summary + speed history for a specific rider. */
  getSummary(riderId: string): Observable<RiderSummary> {
    return this.http.get<RiderSummary>(`/api/analytics/${riderId}`);
  }

  /** Returns the list of all riders from the availability endpoint. */
  getRiders(): Observable<RiderOption[]> {
    return this.http.get<Array<{ riderId: string; name?: string }>>('/api/riders/availability').pipe(
      map(list => list.map(r => ({ id: r.riderId, name: r.name || r.riderId })))
    );
  }
}
