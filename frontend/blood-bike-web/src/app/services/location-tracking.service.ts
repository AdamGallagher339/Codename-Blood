import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { LocationUpdate, TrackedEntity, WebSocketMessage } from '../models/location.model';

@Injectable({
  providedIn: 'root'
})
export class LocationTrackingService {
  private http = inject(HttpClient);
  
  // API endpoints - uses proxy.conf.json in development
  private readonly API_BASE = '/api/tracking';
  private readonly WS_BASE = 'ws://localhost:8080/api/tracking';
  
  // WebSocket connection
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000; // 3 seconds
  
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
   * Connect to WebSocket for real-time location updates
   */
  connectWebSocket(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }
    
    this.connectionStatus$.next('connecting');
    
    try {
      this.ws = new WebSocket(`${this.WS_BASE}/ws`);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.connectionStatus$.next('connected');
        this.reconnectAttempts = 0;
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          if (message.type === 'initial' && message.locations) {
            // Initial load of all locations
            this.allLocations$.next(message.locations);
            message.locations.forEach(loc => this.locationUpdates$.next(loc));
          } else if (message.type === 'update' && message.location) {
            // Single location update
            this.locationUpdates$.next(message.location);
            
            // Update allLocations array
            const currentLocations = this.allLocations$.value;
            const index = currentLocations.findIndex(l => l.entityId === message.location!.entityId);
            if (index >= 0) {
              currentLocations[index] = message.location;
            } else {
              currentLocations.push(message.location);
            }
            this.allLocations$.next([...currentLocations]);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.connectionStatus$.next('disconnected');
        this.attemptReconnect();
      };
      
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      this.connectionStatus$.next('disconnected');
      this.attemptReconnect();
    }
  }
  
  /**
   * Disconnect from WebSocket
   */
  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionStatus$.next('disconnected');
  }
  
  /**
   * Send location update through WebSocket (if connected)
   */
  sendLocationViaWebSocket(update: Partial<LocationUpdate>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(update));
    } else {
      console.warn('WebSocket not connected, cannot send location');
    }
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
   * Attempt to reconnect to WebSocket with exponential backoff
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
