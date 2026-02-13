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
  
  // Polling (HTTP) instead of WebSockets (Lambda + API Gateway REST friendly)
  private pollingSub: Subscription | null = null;
  private lastSeenUpdatedAtByEntity = new Map<string, string>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000; // 3 seconds
  private readonly defaultPollMs = 3000;
  
  // Observable streams for real-time updates
  private locationUpdates$ = new Subject<LocationUpdate>();
  private connectionStatus$ = new BehaviorSubject<'connected' | 'disconnected' | 'connecting'>('disconnected');
  private allLocations$ = new BehaviorSubject<LocationUpdate[]>([]);
  
  /**
   * Send a location update to the server via HTTP POST
   */
  updateLocation(update: Partial<LocationUpdate>): Observable<any> {
    return this.http.post(`${this.API_BASE}/update`, update);
  }
  
  /**
   * Get all current locations via HTTP GET
   */
  getAllLocations(): Observable<LocationUpdate[]> {
    return this.http.get<LocationUpdate[]>(`${this.API_BASE}/locations`);
  }
  
  /**
   * Get all tracked entities via HTTP GET
   */
  getAllEntities(): Observable<TrackedEntity[]> {
    return this.http.get<TrackedEntity[]>(`${this.API_BASE}/entities`);
  }
  
  /**
   * Connect to tracking updates.
   *
   * Historically this used WebSockets, but for the Lambda + API Gateway deployment
   * we use simple HTTP polling.
   */
  connectWebSocket(): void {
    if (this.pollingSub) {
      return;
    }

    this.connectionStatus$.next('connecting');
    this.startPolling(this.defaultPollMs);
  }
  
  /**
   * Disconnect from tracking updates.
   */
  disconnectWebSocket(): void {
    this.stopPolling();
    this.connectionStatus$.next('disconnected');
  }
  
  /**
   * Send location update (legacy name kept for compatibility).
   */
  sendLocationViaWebSocket(update: Partial<LocationUpdate>): void {
    this.updateLocation(update).subscribe({
      error: (err) => console.error('Failed to send location update:', err),
    });
  }
  
  /**
   * Get observable stream of location updates
   */
  getLocationUpdates(): Observable<LocationUpdate> {
    return this.locationUpdates$.asObservable();
  }
  
  /**
   * Get observable of all locations
   */
  getAllLocationsStream(): Observable<LocationUpdate[]> {
    return this.allLocations$.asObservable();
  }
  
  /**
   * Get observable of connection status
   */
  getConnectionStatus(): Observable<'connected' | 'disconnected' | 'connecting'> {
    return this.connectionStatus$.asObservable();
  }
  
  /**
   * Attempt to reconnect polling with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connectWebSocket();
    }, delay);
  }

  private startPolling(intervalMs: number): void {
    this.pollingSub = interval(intervalMs)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.getAllLocations().pipe(
            catchError((err) => {
              console.error('Polling error:', err);
              this.connectionStatus$.next('disconnected');
              this.stopPolling();
              this.attemptReconnect();
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

  private stopPolling(): void {
    if (this.pollingSub) {
      this.pollingSub.unsubscribe();
      this.pollingSub = null;
    }
  }

  private applyPolledLocations(locations: LocationUpdate[]): void {
    // Update snapshot
    this.allLocations$.next(locations);

    // Emit only changed locations to keep marker animation reasonable
    for (const loc of locations) {
      const previous = this.lastSeenUpdatedAtByEntity.get(loc.entityId);
      if (!previous || previous !== loc.updatedAt) {
        this.lastSeenUpdatedAtByEntity.set(loc.entityId, loc.updatedAt);
        this.locationUpdates$.next(loc);
      }
    }
  }
  
  /**
   * Check if a location is stale (older than 5 minutes)
   */
  isLocationStale(location: LocationUpdate): boolean {
    const now = new Date().getTime();
    const updateTime = new Date(location.updatedAt).getTime();
    const fiveMinutes = 5 * 60 * 1000;
    
    return (now - updateTime) > fiveMinutes;
  }
}
