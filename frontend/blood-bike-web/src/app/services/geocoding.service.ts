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
  private nominatimUrl = 'https://nominatim.openstreetmap.org/search';

  /**
   * Geocode a place name or address to lat/lng using OpenStreetMap Nominatim.
   * Returns null if no result found.
   */
  geocode(query: string): Observable<GeocodedLocation | null> {
    const params = {
      q: query,
      format: 'json',
      limit: '1',
      countrycodes: 'ie'
    };

    return this.http
      .get<NominatimResult[]>(this.nominatimUrl, {
        params,
        headers: { 'Accept-Language': 'en' }
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
