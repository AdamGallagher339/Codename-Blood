import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject, Subscription, interval, of } from 'rxjs';
import { catchError, startWith, switchMap } from 'rxjs/operators';
import { LocationUpdate, TrackedEntity } from '../models/location.model';

@Injectable({
  providedIn: 'root'
})
export class LocationTrackingService {
  private http = inject(HttpClient);

  // API endpoints - uses proxy.conf.json in development
  private readonly API_BASE = '/api/tracking';

  // ---------------------------------------------------------------------------
  // Cost-efficient polling
  // At 15 s each open browser tab makes ~240 API calls/hour instead of 1,200.
  // ---------------------------------------------------------------------------
  private readonly defaultPollMs = 15_000;

  private pollingSub: Subscription | null = null;
  private pollingMode: 'locations' | 'riders' = 'riders';
  private lastSeenUpdatedAtByEntity = new Map<string, string>();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 3_000;

  // ---------------------------------------------------------------------------
  // Page Visibility API — pauses polling when the tab is backgrounded so
  // invisible tabs don't waste Lambda invocations.
  // ---------------------------------------------------------------------------
  private visibilityListenerAdded = false;
  private readonly visibilityHandler = () => {
    if (document.hidden) {
      this.stopPolling();
    } else if (!this.pollingSub) {
      // Tab became visible again — resume the same endpoint
      this.resumePolling();
    }
  };

  // ---------------------------------------------------------------------------
  // Minimum-distance gate for outgoing location POSTs.
  // Riders must move ≥ 30 m before a new update is sent, eliminating the
  // spurious API calls caused by GPS jitter while stationary.
  // ---------------------------------------------------------------------------
  private lastPublishedLat: number | null = null;
  private lastPublishedLng: number | null = null;
  private readonly MIN_DISTANCE_M = 30;

  // Observable streams for real-time updates
  private locationUpdates$ = new Subject<LocationUpdate>();
  private connectionStatus$ = new BehaviorSubject<'connected' | 'disconnected' | 'connecting'>('disconnected');
  private allLocations$ = new BehaviorSubject<LocationUpdate[]>([]);

  // ---------------------------------------------------------------------------
  // HTTP helpers
  // ---------------------------------------------------------------------------

  updateLocation(update: Partial<LocationUpdate>): Observable<any> {
    return this.http.post(`${this.API_BASE}/update`, update);
  }

  getAllLocations(): Observable<LocationUpdate[]> {
    return this.http.get<LocationUpdate[]>(`${this.API_BASE}/locations`);
  }

  getAllEntities(): Observable<TrackedEntity[]> {
    return this.http.get<TrackedEntity[]>(`${this.API_BASE}/entities`);
  }

  getRiders(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_BASE}/riders`).pipe(
      catchError(() => of([]))
    );
  }

  // ---------------------------------------------------------------------------
  // Polling lifecycle (public)
  // ---------------------------------------------------------------------------

  /**
   * Start polling /tracking/locations endpoint.
   * Legacy — prefer startRidersPolling() for the map view.
   */
  connectWebSocket(): void {
    if (this.pollingSub) return;
    this.pollingMode = 'locations';
    this.connectionStatus$.next('connecting');
    this.startPollingLocations(this.defaultPollMs);
    this.ensureVisibilityListener();
  }

  disconnectWebSocket(): void {
    this.stopPolling();
    this.removeVisibilityListener();
    this.connectionStatus$.next('disconnected');
  }

  /**
   * Start polling /tracking/riders — used by the tracking map.
   */
  startRidersPolling(pollMs = this.defaultPollMs): void {
    this.stopPolling();
    this.pollingMode = 'riders';
    this.startPollingRiders(pollMs);
    this.connectionStatus$.next('connected');
    this.ensureVisibilityListener();
  }

  stopRidersPolling(): void {
    this.stopPolling();
    this.removeVisibilityListener();
  }

  // ---------------------------------------------------------------------------
  // Location transmission (rider → server)
  // ---------------------------------------------------------------------------

  /**
   * Send the rider's GPS position to the server — but only if they have moved
   * ≥ MIN_DISTANCE_M metres since the last transmission.
   */
  sendLocationViaWebSocket(update: Partial<LocationUpdate>): void {
    const lat = update.latitude;
    const lng = update.longitude;

    if (
      lat != null && lng != null &&
      this.lastPublishedLat != null && this.lastPublishedLng != null
    ) {
      const dist = this.haversineDistance(
        this.lastPublishedLat, this.lastPublishedLng, lat, lng
      );
      if (dist < this.MIN_DISTANCE_M) return; // skip — rider hasn't moved enough
    }

    this.lastPublishedLat = lat ?? null;
    this.lastPublishedLng = lng ?? null;
    this.updateLocation(update).subscribe({
      error: (err) => console.error('Failed to send location update:', err),
    });
  }

  // ---------------------------------------------------------------------------
  // Observable accessors
  // ---------------------------------------------------------------------------

  getLocationUpdates(): Observable<LocationUpdate> {
    return this.locationUpdates$.asObservable();
  }

  getAllLocationsStream(): Observable<LocationUpdate[]> {
    return this.allLocations$.asObservable();
  }

  getConnectionStatus(): Observable<'connected' | 'disconnected' | 'connecting'> {
    return this.connectionStatus$.asObservable();
  }

  isLocationStale(location: LocationUpdate): boolean {
    const fiveMinutes = 5 * 60 * 1_000;
    return (Date.now() - new Date(location.updatedAt).getTime()) > fiveMinutes;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private startPollingLocations(intervalMs: number): void {
    this.pollingSub = interval(intervalMs)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.getAllLocations().pipe(
            catchError((err) => {
              console.error('Polling error:', err);
              this.connectionStatus$.next('disconnected');
              this.stopPolling();
              this.scheduleReconnect();
              return of<LocationUpdate[] | null>(null);
            })
          )
        )
      )
      .subscribe((locations) => {
        if (!locations) return;
        this.connectionStatus$.next('connected');
        this.applyPolledLocations(locations);
      });
  }

  private startPollingRiders(intervalMs: number): void {
    this.pollingSub = interval(intervalMs)
      .pipe(
        startWith(0),
        switchMap(() => this.getRiders())
      )
      .subscribe((riders) => {
        this.connectionStatus$.next('connected');
        this.applyPolledLocations(riders);
      });
  }

  private stopPolling(): void {
    this.pollingSub?.unsubscribe();
    this.pollingSub = null;
  }

  private resumePolling(): void {
    this.connectionStatus$.next('connecting');
    if (this.pollingMode === 'riders') {
      this.startPollingRiders(this.defaultPollMs);
    } else {
      this.startPollingLocations(this.defaultPollMs);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    setTimeout(() => this.resumePolling(), delay);
  }

  private applyPolledLocations(locations: LocationUpdate[]): void {
    this.allLocations$.next(locations);
    for (const loc of locations) {
      const previous = this.lastSeenUpdatedAtByEntity.get(loc.entityId);
      if (!previous || previous !== loc.updatedAt) {
        this.lastSeenUpdatedAtByEntity.set(loc.entityId, loc.updatedAt);
        this.locationUpdates$.next(loc);
      }
    }
  }

  private ensureVisibilityListener(): void {
    if (!this.visibilityListenerAdded) {
      document.addEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityListenerAdded = true;
    }
  }

  private removeVisibilityListener(): void {
    if (this.visibilityListenerAdded) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityListenerAdded = false;
    }
  }

  /**
   * Haversine distance in metres between two lat/lng points.
   */
  private haversineDistance(
    lat1: number, lng1: number, lat2: number, lng2: number
  ): number {
    const R = 6_371_000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
