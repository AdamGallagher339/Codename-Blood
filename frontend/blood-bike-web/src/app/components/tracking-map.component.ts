import { Component, OnInit, OnDestroy, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { LocationTrackingService } from '../services/location-tracking.service';
import { LocationUpdate } from '../models/location.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-tracking-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tracking-map.component.html',
  styleUrls: ['./tracking-map.component.scss']
})
export class TrackingMapComponent implements OnInit, OnDestroy, AfterViewInit {
  private locationService = inject(LocationTrackingService);
  
  // Map and markers
  private map: L.Map | null = null;
  private markers: Map<string, L.Marker> = new Map();
  private selectedEntityId: string | null = null;
  
  // Subscriptions
  private subscriptions: Subscription[] = [];
  
  // Component state
  connectionStatus: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
  locations: LocationUpdate[] = [];
  selectedLocation: LocationUpdate | null = null;
  showInfo = true;
  
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
      this.initializeMap();
      this.connectToTracking();
    }, 100);
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    
    // Disconnect WebSocket
    this.locationService.disconnectWebSocket();
    
    // Clean up map
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  /**
   * Initialize the Leaflet map
   */
  private initializeMap(): void {
    // Create map centered on UK (default location)
    this.map = L.map('map', {
      center: [54.5, -4], // Center of UK
      zoom: 6,
      zoomControl: true
    });

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);
    
    console.log('Map initialized');
  }

  /**
   * Connect to location tracking service
   */
  private connectToTracking(): void {
    this.locationService.connectWebSocket();
  }

  /**
   * Handle incoming location update
   */
  private handleLocationUpdate(location: LocationUpdate): void {
    if (!this.map) return;
    
    const isStale = this.locationService.isLocationStale(location);
    const marker = this.markers.get(location.entityId);
    
    if (marker) {
      // Update existing marker with smooth animation
      const newLatLng = L.latLng(location.latitude, location.longitude);
      this.animateMarker(marker, newLatLng);
      
      // Update icon based on staleness
      marker.setIcon(isStale ? this.staleIcon : this.activeIcon);
      
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
    const icon = isStale ? this.staleIcon : this.activeIcon;
    
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
