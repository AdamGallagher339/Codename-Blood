import { Component, signal, output, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CreateEventDto, EventType, EventPriority } from '../models/event.model';
import { QrScannerComponent } from './qr-scanner.component';
import * as L from 'leaflet';

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [CommonModule, FormsModule, QrScannerComponent],
  templateUrl: './event-form.component.html',
  styleUrl: './event-form.component.scss'
})
export class EventFormComponent implements OnDestroy {
  showModal = signal(false);
  showScanner = signal(false);
  showMapPicker = signal(false);

  eventCreated = output<CreateEventDto>();
  modalClosed = output<void>();

  // Form fields
  title = signal('');
  description = signal('');
  date = signal(this.getTodayString());
  startTime = signal('09:00');
  endTime = signal('10:00');
  location = signal('');
  lat = signal<number | null>(null);
  lng = signal<number | null>(null);
  type = signal<EventType>(EventType.DELIVERY);
  priority = signal<EventPriority>(EventPriority.MEDIUM);

  private pickerMap: L.Map | null = null;
  private pickerMarker: L.Marker | null = null;
  
  eventTypes = [
    { value: EventType.DELIVERY, label: 'Delivery', icon: '🚴' },
    { value: EventType.TRAINING, label: 'Training', icon: '📚' },
    { value: EventType.MAINTENANCE, label: 'Maintenance', icon: '🔧' },
    { value: EventType.MEETING, label: 'Meeting', icon: '👥' },
    { value: EventType.EMERGENCY, label: 'Emergency', icon: '🚨' },
    { value: EventType.OTHER, label: 'Other', icon: '📋' }
  ];
  
  priorities = [
    { value: EventPriority.LOW, label: 'Low', color: '#4caf50' },
    { value: EventPriority.MEDIUM, label: 'Medium', color: '#ff9800' },
    { value: EventPriority.HIGH, label: 'High', color: '#f44336' },
    { value: EventPriority.URGENT, label: 'Urgent', color: '#9c27b0' }
  ];

  open(): void {
    this.resetForm();
    this.showModal.set(true);
  }

  close(): void {
    this.showModal.set(false);
    this.showScanner.set(false);
    this.showMapPicker.set(false);
    this.destroyPickerMap();
    this.modalClosed.emit();
  }

  ngOnDestroy(): void {
    this.destroyPickerMap();
  }

  openScanner(): void {
    this.showScanner.set(true);
  }

  onScanComplete(scannedValue: string): void {
    this.location.set(scannedValue);
    this.showScanner.set(false);
  }

  toggleMapPicker(): void {
    if (this.showMapPicker()) {
      this.showMapPicker.set(false);
      this.destroyPickerMap();
    } else {
      this.showMapPicker.set(true);
      // Defer init until Angular has rendered the container div
      setTimeout(() => this.initPickerMap(), 50);
    }
  }

  clearMapLocation(): void {
    this.lat.set(null);
    this.lng.set(null);
    if (this.pickerMarker && this.pickerMap) {
      this.pickerMarker.remove();
      this.pickerMarker = null;
    }
  }

  private initPickerMap(): void {
    const container = document.getElementById('event-map-picker');
    if (!container || this.pickerMap) return;

    const defaultLat = this.lat() ?? 53.2707;
    const defaultLng = this.lng() ?? -9.0568;

    this.pickerMap = L.map('event-map-picker', { zoomControl: true }).setView(
      [defaultLat, defaultLng],
      10
    );

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(this.pickerMap);

    // Place marker if coords already set
    if (this.lat() !== null && this.lng() !== null) {
      this.placePickerMarker(this.lat()!, this.lng()!);
    }

    this.pickerMap.on('click', (e: L.LeafletMouseEvent) => {
      this.lat.set(parseFloat(e.latlng.lat.toFixed(6)));
      this.lng.set(parseFloat(e.latlng.lng.toFixed(6)));
      this.placePickerMarker(e.latlng.lat, e.latlng.lng);
    });
  }

  private placePickerMarker(lat: number, lng: number): void {
    if (!this.pickerMap) return;
    if (this.pickerMarker) {
      this.pickerMarker.setLatLng([lat, lng]);
    } else {
      this.pickerMarker = L.marker([lat, lng], {
        icon: L.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      }).addTo(this.pickerMap);
    }
  }

  private destroyPickerMap(): void {
    if (this.pickerMarker) {
      this.pickerMarker.remove();
      this.pickerMarker = null;
    }
    if (this.pickerMap) {
      this.pickerMap.remove();
      this.pickerMap = null;
    }
  }
  
  submitEvent(): void {
    if (!this.isFormValid()) {
      return;
    }

    const eventDto: CreateEventDto = {
      title: this.title(),
      description: this.description(),
      date: new Date(this.date()),
      startTime: this.startTime(),
      endTime: this.endTime(),
      location: this.location(),
      type: this.type(),
      priority: this.priority(),
      ...(this.lat() !== null && this.lng() !== null
        ? { lat: this.lat()!, lng: this.lng()! }
        : {})
    };

    this.eventCreated.emit(eventDto);
  }
  
  isFormValid(): boolean {
    return this.title().trim().length > 0 &&
           this.date().length > 0 &&
           this.startTime().length > 0 &&
           this.endTime().length > 0 &&
           this.location().trim().length > 0;
  }
  
  private resetForm(): void {
    this.title.set('');
    this.description.set('');
    this.date.set(this.getTodayString());
    this.startTime.set('09:00');
    this.endTime.set('10:00');
    this.location.set('');
    this.lat.set(null);
    this.lng.set(null);
    this.showMapPicker.set(false);
    this.destroyPickerMap();
    this.type.set(EventType.DELIVERY);
    this.priority.set(EventPriority.MEDIUM);
  }
  
  private getTodayString(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
