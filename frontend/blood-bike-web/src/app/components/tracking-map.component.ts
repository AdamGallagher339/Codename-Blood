import { Component, OnInit, OnDestroy, AfterViewInit, inject, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { LocationTrackingService } from '../services/location-tracking.service';
import { LocationUpdate } from '../models/location.model';
import { EventService } from '../services/event.service';
import { AuthService } from '../services/auth.service';
import { Event as AppEvent } from '../models/event.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-tracking-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tracking-map.component.html',
  styleUrls: ['./tracking-map.component.scss']
})
export class TrackingMapComponent implements OnInit, OnDestroy, AfterViewInit {
  locationService = inject(LocationTrackingService);
  private eventService = inject(EventService);
  private authService = inject(AuthService);
  private http = inject(HttpClient);

  // Events (loaded from service; component subscribes reactively via effect)
  events = this.eventService.getEvents();
  showEvents = signal(true);
  private eventMarkers: Map<string, L.Marker> = new Map();

  // Jobs with pinned locations
  showJobMarkers = signal(true);
  private jobMarkers: Map<string, L.Marker> = new Map();      // pickup (green)
  private jobDropoffMarkers: Map<string, L.Marker> = new Map(); // delivery (red) — role-scoped
  private jobRefreshIntervalId: ReturnType<typeof setInterval> | null = null;

  // Set to true in ngOnDestroy so all pending timers know to abort
  private destroyed = false;

  // Map and markers
  private map: L.Map | null = null;
  private markers: Map<string, L.Marker> = new Map();
  selectedEntityId: string | null = null;

  // Subscriptions
  private subscriptions: Subscription[] = [];

  // Component state
  connectionStatus: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
  locations: LocationUpdate[] = [];
  selectedLocation: LocationUpdate | null = null;
  showInfo = true;

  // My Location state
  isWatchingLocation = false;
  myLocationError: string | null = null;
  private myLocationMarker: L.Marker | null = null;
  private myLocationCircle: L.Circle | null = null;
  private geolocationWatchId: number | null = null;

  constructor() {
    // Whenever the events signal updates, sync markers onto the map
    effect(() => {
      const currentEvents = this.events();
      if (this.map) {
        this.syncEventMarkers(currentEvents);
      }
    });
  }
  
  // Leaflet icon configuration (fix for default icon issue)
  private defaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
  
  private activeIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
  
  private staleIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
  
  // Icon for active riders (blue)
  private riderIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
  
  // Icon for stale rider locations (grey)
  private staleRiderIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  // Icon for event waypoints (orange)
  private eventIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  // Icon for job pickup locations (green)
  private jobIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  // Icon for job delivery locations (red) — only shown to managers or job acceptor
  private jobDropoffIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  // Build the "you are here" icon with a live speed readout above and rider emoji below.
  private buildMyLocationIcon(speedKph: number | null, accuracyM: number | null = null): L.DivIcon {
    const speedLabel = speedKph !== null && speedKph >= 0
      ? `${Math.round(speedKph)} km/h`
      : '';
    const accuracyLabel = accuracyM !== null
      ? `±${Math.round(accuracyM)}m`
      : '';
    return L.divIcon({
      className: '',
      html: `
        <div class="my-loc-wrapper">
          <div class="my-loc-speed">${speedLabel}</div>
          <div class="my-location-dot"><div class="my-location-pulse"></div></div>
          <div class="my-loc-rider">🏍️</div>
          ${accuracyLabel ? `<div class="my-loc-accuracy">${accuracyLabel}</div>` : ''}
        </div>`,
      iconSize: [64, 80],
      iconAnchor: [32, 42],
      popupAnchor: [0, -46]
    });
  }

  ngOnInit(): void {
    // Subscribe to connection status
    this.subscriptions.push(
      this.locationService.getConnectionStatus().subscribe(status => {
        this.connectionStatus = status;
      })
    );
    
    // Subscribe to location updates
    this.subscriptions.push(
      this.locationService.getLocationUpdates().subscribe(location => {
        this.handleLocationUpdate(location);
      })
    );
    
    // Subscribe to all locations
    this.subscriptions.push(
      this.locationService.getAllLocationsStream().subscribe(locations => {
        this.locations = locations;
      })
    );
  }

  ngAfterViewInit(): void {
    // Initialize map after view is ready
    setTimeout(() => {
      // Guard: component may have been destroyed during the 100ms delay
      if (this.destroyed) return;
      this.initializeMap();
      this.connectToTracking();
      // Sync any events that loaded before the map was ready
      this.syncEventMarkers(this.events());
    }, 100);
  }

  ngOnDestroy(): void {
    // Signal all pending timers (animateMarker, etc.) to abort immediately
    this.destroyed = true;

    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());

    // Stop geolocation watch
    this.stopLocating();

    // Disconnect polling
    this.locationService.disconnectWebSocket();

    // Clean up event markers
    this.eventMarkers.forEach(m => m.remove());
    this.eventMarkers.clear();

    // Clean up job markers
    this.jobMarkers.forEach(m => m.remove());
    this.jobMarkers.clear();
    this.jobDropoffMarkers.forEach(m => m.remove());
    this.jobDropoffMarkers.clear();
    if (this.jobRefreshIntervalId !== null) {
      clearInterval(this.jobRefreshIntervalId);
      this.jobRefreshIntervalId = null;
    }

    // Stop all in-progress Leaflet pan/zoom animations BEFORE removing the
    // container — otherwise Leaflet's animation timers fire panBy() on a
    // container that no longer exists, causing the classList crash.
    if (this.map) {
      this.map.stop();
      this.map.remove();
      this.map = null;
    }
  }

  /**
   * Initialize the Leaflet map
   */
  private initializeMap(): void {
    const irelandBounds = L.latLngBounds(
      [51.35, -10.75],
      [55.45, -5.35]
    );

    // Create map centered on Galway
    this.map = L.map('map', {
      center: [53.2707, -9.0568],
      zoom: 7,
      minZoom: 7,
      maxBounds: irelandBounds,
      maxBoundsViscosity: 1.0,
      zoomControl: true
    });

    // Enforce bounds immediately after map init.
    this.map.setMaxBounds(irelandBounds);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);
    
    // Add hospital locations
    this.addHospitals();

    // Load jobs with pinned locations and refresh every 30 seconds
    this.loadJobMarkers();
    this.jobRefreshIntervalId = setInterval(() => this.loadJobMarkers(), 30_000);

    console.log('Map initialized');
  }

  /**
   * Add hospital markers to the map.
   * To add a new hospital, add an entry to the hospitals array.
   * Coordinates can be looked up via maps.google.com or openstreetmap.org.
   */
  private addHospitals(): void {
    if (!this.map) return;

    const hospitalIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    const hospitals: { label: string; address: string; type: string; lat: number; lng: number }[] = [
      {
        label: 'University Hospital Galway',
        address: 'Newcastle Rd, Galway',
        type: 'Major Teaching Hospital',
        lat: 53.276816153524535,
        lng: -9.065837647021125
      },
      {
        label: 'Merlin Park Regional Hospital',
        address: 'Old Dublin Rd, Galway',
        type: 'Regional Hospital',
        lat: 53.27793709289205,
        lng: -8.988170798854288
      }
    ];

    hospitals.forEach(h => {
      if (!this.map) return;
      L.marker([h.lat, h.lng], { icon: hospitalIcon })
        .addTo(this.map)
        .bindPopup(`
          <div class="hospital-marker">
            <h4>🏥 ${h.label}</h4>
            <p><strong>Address:</strong> ${h.address}</p>
            <p><strong>Type:</strong> ${h.type}</p>
          </div>
        `);
    });
  }

  /**
   * Connect to location tracking service.
   * Uses startRidersPolling only — calling connectWebSocket() before it was
   * redundant because startRidersPolling() cancelled that subscription anyway.
   */
  private connectToTracking(): void {
    this.locationService.startRidersPolling();
  }

  /**
   * Start watching the user's own GPS location and show it on the map.
   */
  locateMe(): void {
    if (!navigator.geolocation) {
      this.myLocationError = 'Geolocation is not supported by your browser.';
      return;
    }

    this.myLocationError = null;
    this.isWatchingLocation = true;

    this.geolocationWatchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy, speed } = position.coords;
        // speed is in m/s; convert to km/h (null if unavailable)
        const speedKph = speed != null ? speed * 3.6 : null;
        this.updateMyLocationMarker(latitude, longitude, accuracy, speedKph);
      },
      (err) => {
        this.isWatchingLocation = false;
        switch (err.code) {
          case err.PERMISSION_DENIED:
            this.myLocationError = 'Location permission denied.';
            break;
          case err.POSITION_UNAVAILABLE:
            this.myLocationError = 'Location unavailable.';
            break;
          case err.TIMEOUT:
            this.myLocationError = 'Location request timed out.';
            break;
          default:
            this.myLocationError = 'Could not get location.';
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  }

  /**
   * Stop watching the user's GPS location.
   */
  stopLocating(): void {
    if (this.geolocationWatchId !== null) {
      navigator.geolocation.clearWatch(this.geolocationWatchId);
      this.geolocationWatchId = null;
    }
    this.isWatchingLocation = false;

    // Remove marker and accuracy circle from map
    if (this.myLocationMarker) {
      this.myLocationMarker.remove();
      this.myLocationMarker = null;
    }
    if (this.myLocationCircle) {
      this.myLocationCircle.remove();
      this.myLocationCircle = null;
    }
  }

  /**
   * Pan map to the user's current location.
   */
  centerOnMe(): void {
    if (this.myLocationMarker && this.map) {
      this.map.flyTo(this.myLocationMarker.getLatLng(), 16);
    }
  }

  /**
   * Place or update the "you are here" marker and accuracy circle.
   */
  private updateMyLocationMarker(lat: number, lng: number, accuracy: number, speedKph: number | null = null): void {
    if (!this.map) return;

    const icon = this.buildMyLocationIcon(speedKph, accuracy);

    if (!this.myLocationMarker) {
      // First fix — place marker, draw accuracy ring, fly to location
      this.myLocationMarker = L.marker([lat, lng], { icon, zIndexOffset: 1000 })
        .addTo(this.map)
        .bindPopup('<strong>📍 You are here</strong>');

      this.myLocationCircle = L.circle([lat, lng], {
        radius: accuracy,
        color: '#4A90E2',
        fillColor: '#4A90E2',
        fillOpacity: 0.10,
        weight: 1
      }).addTo(this.map);

      this.map.flyTo([lat, lng], 16);
    } else {
      // Subsequent updates — move marker, update speed badge, update ring
      this.myLocationMarker.setLatLng([lat, lng]);
      this.myLocationMarker.setIcon(icon);
      this.myLocationCircle?.setLatLng([lat, lng]).setRadius(accuracy);
    }
  }

  /**
   * Handle incoming location update
   */
  private handleLocationUpdate(location: LocationUpdate): void {
    if (!this.map) return;
    
    const isStale = this.locationService.isLocationStale(location);
    const marker = this.markers.get(location.entityId);
    
    // Select appropriate icon based on entity type
    const activeIcon = location.entityType === 'rider' ? this.riderIcon : this.activeIcon;
    const staleIcon = location.entityType === 'rider' ? this.staleRiderIcon : this.staleIcon;
    
    if (marker) {
      // Update existing marker with smooth animation
      const newLatLng = L.latLng(location.latitude, location.longitude);
      this.animateMarker(marker, newLatLng);
      
      // Update icon based on staleness and entity type
      marker.setIcon(isStale ? staleIcon : activeIcon);
      
      // Update popup content
      marker.setPopupContent(this.createPopupContent(location));
      
      // Update selected location if this is the selected entity
      if (this.selectedEntityId === location.entityId) {
        this.selectedLocation = location;
        
        // Auto-follow if this is the selected marker
        this.map.panTo(newLatLng);
      }
    } else {
      // Create new marker
      this.createMarker(location);
    }
  }

  /**
   * Create a new marker on the map
   */
  private createMarker(location: LocationUpdate): void {
    if (!this.map) return;
    
    const isStale = this.locationService.isLocationStale(location);
    // Select appropriate icon based on entity type
    let icon: L.Icon;
    if (location.entityType === 'rider') {
      icon = isStale ? this.staleRiderIcon : this.riderIcon;
    } else {
      icon = isStale ? this.staleIcon : this.activeIcon;
    }
    
    const marker = L.marker([location.latitude, location.longitude], { icon })
      .addTo(this.map)
      .bindPopup(this.createPopupContent(location));
    
    // Add click handler to select entity
    marker.on('click', () => {
      this.selectEntity(location.entityId);
    });
    
    this.markers.set(location.entityId, marker);
  }

  /**
   * Create popup content for a marker
   */
  private createPopupContent(location: LocationUpdate): string {
    const lastUpdate = new Date(location.updatedAt).toLocaleString();
    const isStale = this.locationService.isLocationStale(location);
    
    return `
      <div class="marker-popup">
        <h4>${location.entityType}: ${location.entityId}</h4>
        <p><strong>Coordinates:</strong><br>${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}</p>
        ${location.speed !== undefined ? `<p><strong>Speed:</strong> ${location.speed.toFixed(1)} km/h</p>` : ''}
        ${location.heading !== undefined ? `<p><strong>Heading:</strong> ${location.heading.toFixed(0)}°</p>` : ''}
        ${location.altitude !== undefined ? `<p><strong>Altitude:</strong> ${location.altitude.toFixed(0)}m</p>` : ''}
        ${location.accuracy !== undefined ? `<p><strong>Accuracy:</strong> ${location.accuracy.toFixed(0)}m</p>` : ''}
        <p><strong>Last Update:</strong><br>${lastUpdate}</p>
        ${isStale ? '<p class="stale-warning">⚠️ Location data is stale</p>' : ''}
      </div>
    `;
  }

  /**
   * Animate marker movement to new position
   */
  private animateMarker(marker: L.Marker, newLatLng: L.LatLng): void {
    const currentLatLng = marker.getLatLng();
    const duration = 1000; // 1 second animation
    const frames = 60;
    const frameDelay = duration / frames;

    let frame = 0;

    const animate = () => {
      // Abort if component has been destroyed — prevents the classList crash
      // caused by Leaflet trying to update a removed map container.
      if (this.destroyed || !this.map) return;

      frame++;
      const progress = frame / frames;

      // Linear interpolation
      const lat = currentLatLng.lat + (newLatLng.lat - currentLatLng.lat) * progress;
      const lng = currentLatLng.lng + (newLatLng.lng - currentLatLng.lng) * progress;

      marker.setLatLng([lat, lng]);

      if (frame < frames) {
        setTimeout(animate, frameDelay);
      }
    };

    animate();
  }

  /**
   * Select an entity to follow
   */
  selectEntity(entityId: string | null): void {
    this.selectedEntityId = entityId;
    
    if (entityId) {
      const location = this.locations.find(l => l.entityId === entityId);
      if (location) {
        this.selectedLocation = location;
        
        // Center map on selected marker
        if (this.map) {
          this.map.flyTo([location.latitude, location.longitude], 15);
        }
      }
    } else {
      this.selectedLocation = null;
    }
  }

  /**
   * Fit map to show all markers
   */
  fitToAllMarkers(): void {
    if (!this.map || this.markers.size === 0) return;
    
    const group = L.featureGroup(Array.from(this.markers.values()));
    this.map.fitBounds(group.getBounds().pad(0.1));
  }

  /**
   * Toggle info panel visibility
   */
  toggleInfo(): void {
    this.showInfo = !this.showInfo;
  }

  /**
   * Reconnect to WebSocket
   */
  reconnect(): void {
    this.locationService.disconnectWebSocket();
    setTimeout(() => {
      this.locationService.connectWebSocket();
    }, 500);
  }

  /**
   * Clear selected entity
   */
  clearSelection(): void {
    this.selectEntity(null);
  }

  /**
   * Toggle event waypoints on/off the map
   */
  toggleEventMarkers(): void {
    const show = !this.showEvents();
    this.showEvents.set(show);
    this.eventMarkers.forEach(marker => {
      if (!this.map) return;
      if (show) {
        if (!this.map.hasLayer(marker)) marker.addTo(this.map);
      } else {
        if (this.map.hasLayer(marker)) marker.remove();
      }
    });
  }

  /**
   * Sync event markers with current event list (adds new, removes deleted)
   */
  private syncEventMarkers(events: AppEvent[]): void {
    if (!this.map) return;

    const eventsWithCoords = events.filter(e => e.lat != null && e.lng != null);
    const newIds = new Set(eventsWithCoords.map(e => e.id));

    // Remove markers for events no longer present
    this.eventMarkers.forEach((marker, id) => {
      if (!newIds.has(id)) {
        marker.remove();
        this.eventMarkers.delete(id);
      }
    });

    // Add or update markers
    eventsWithCoords.forEach(event => {
      const existing = this.eventMarkers.get(event.id);
      if (existing) {
        existing.setLatLng([event.lat!, event.lng!]);
        existing.setPopupContent(this.createEventPopupContent(event));
      } else {
        const marker = L.marker([event.lat!, event.lng!], { icon: this.eventIcon })
          .bindPopup(this.createEventPopupContent(event));
        if (this.showEvents()) {
          marker.addTo(this.map!);
        }
        this.eventMarkers.set(event.id, marker);
      }
    });
  }

  /**
   * Build popup HTML for an event marker
   */
  private createEventPopupContent(event: AppEvent): string {
    const date = new Date(event.date).toLocaleDateString('en-IE', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
    const typeLabel = event.type.charAt(0).toUpperCase() + event.type.slice(1);
    const statusLabel = event.status.charAt(0).toUpperCase() + event.status.slice(1);
    return `
      <div class="event-marker-popup">
        <h4>📅 ${event.title}</h4>
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Time:</strong> ${event.startTime} – ${event.endTime}</p>
        <p><strong>Location:</strong> ${event.location}</p>
        <p><strong>Type:</strong> ${typeLabel}</p>
        <p><strong>Status:</strong> ${statusLabel}</p>
      </div>
    `;
  }

  /** Load jobs from the API and place green markers for those with a pinned pickup location. */
  loadJobMarkers(): void {
    interface JobData {
      jobId: string;
      title: string;
      status: string;
      acceptedBy?: string;
      pickup: { address?: string; lat?: number; lng?: number };
      dropoff: { address?: string; lat?: number; lng?: number };
    }
    this.http.get<JobData[]>('/api/jobs').subscribe({
      next: (jobs) => {
        if (!this.map) return;
        const currentIds = new Set(jobs.map(j => j.jobId));

        // Remove markers for deleted jobs
        this.jobMarkers.forEach((m, id) => {
          if (!currentIds.has(id)) { m.remove(); this.jobMarkers.delete(id); }
        });
        this.jobDropoffMarkers.forEach((m, id) => {
          if (!currentIds.has(id)) { m.remove(); this.jobDropoffMarkers.delete(id); }
        });

        const isManager = ['FleetManager', 'Dispatcher', 'BloodBikeAdmin']
          .some(r => this.authService.hasRole(r));
        const me = this.authService.username();

        jobs.forEach(job => {
          // Completed or cancelled jobs never show pins
          const isActive = job.status !== 'completed' && job.status !== 'cancelled';
          const canSee = isActive && (
            isManager || (!!me && !!job.acceptedBy && job.acceptedBy === me)
          );

          // ---- pickup marker (green) ----
          const pLat = job.pickup?.lat;
          const pLng = job.pickup?.lng;
          if (pLat != null && pLng != null && canSee) {
            const popupP = `<div><h4>🟢 ${job.title}</h4><p><strong>Pickup:</strong> ${job.pickup?.address || 'pinned'}</p><p><strong>Status:</strong> ${job.status}</p></div>`;
            const existingP = this.jobMarkers.get(job.jobId);
            if (existingP) {
              existingP.setLatLng([pLat, pLng]);
              existingP.setPopupContent(popupP);
            } else {
              const m = L.marker([pLat, pLng], { icon: this.jobIcon }).bindPopup(popupP);
              if (this.showJobMarkers()) m.addTo(this.map!);
              this.jobMarkers.set(job.jobId, m);
            }
          } else {
            // Remove pickup marker if user can no longer see this job
            const existingP = this.jobMarkers.get(job.jobId);
            if (existingP) { existingP.remove(); this.jobMarkers.delete(job.jobId); }
          }

          // ---- dropoff marker (red, same visibility rule) ----
          const dLat = job.dropoff?.lat;
          const dLng = job.dropoff?.lng;
          if (dLat != null && dLng != null && canSee) {
            const popupD = `<div><h4>📦 ${job.title} — Delivery</h4><p><strong>Drop-off:</strong> ${job.dropoff?.address || 'pinned'}</p><p><strong>Status:</strong> ${job.status}</p></div>`;
            const existingD = this.jobDropoffMarkers.get(job.jobId);
            if (existingD) {
              existingD.setLatLng([dLat, dLng]);
              existingD.setPopupContent(popupD);
            } else {
              const m = L.marker([dLat, dLng], { icon: this.jobDropoffIcon }).bindPopup(popupD);
              if (this.showJobMarkers()) m.addTo(this.map!);
              this.jobDropoffMarkers.set(job.jobId, m);
            }
          } else {
            // Remove both markers if user can no longer see this job
            const existingD = this.jobDropoffMarkers.get(job.jobId);
            if (existingD) { existingD.remove(); this.jobDropoffMarkers.delete(job.jobId); }
          }
        });
      },
      error: () => { /* jobs API not available (no JOBS_TABLE in local dev) */ }
    });
  }

  /** Toggle green job markers on/off */
  toggleJobMarkers(): void {
    const show = !this.showJobMarkers();
    this.showJobMarkers.set(show);
    this.jobMarkers.forEach(marker => {
      if (!this.map) return;
      if (show) { marker.addTo(this.map); } else { marker.remove(); }
    });
    this.jobDropoffMarkers.forEach(marker => {
      if (!this.map) return;
      if (show) { marker.addTo(this.map); } else { marker.remove(); }
    });
  }

  /**
   * Get formatted time ago string
   */
  getTimeAgo(dateString: string): string {
    const now = new Date().getTime();
    const then = new Date(dateString).getTime();
    const diffMs = now - then;
    
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  }
}
