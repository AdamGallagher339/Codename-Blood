import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';

export interface GeocodedLocation {
  name: string;
  lat: number;
  lng: number;
  displayName: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private http = inject(HttpClient);

  /**
   * Geocode a place name or address to lat/lng.
   * Proxied through the backend to avoid Nominatim's browser request policy.
   */
  geocode(query: string): Observable<GeocodedLocation | null> {
    return this.http
      .get<NominatimResult[]>('/api/geocode', {
        params: { q: query }
      })
      .pipe(
        map(results => {
          if (!results || results.length === 0) return null;
          const r = results[0];
          return {
            name: query,
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lon),
            displayName: r.display_name
          };
        }),
        catchError(err => {
          console.warn(`Geocoding failed for "${query}":`, err);
          return of(null);
        })
      );
  }
}
