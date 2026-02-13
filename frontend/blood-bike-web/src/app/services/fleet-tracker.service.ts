import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of } from 'rxjs';
import {
  FleetBike,
  ServiceEntry,
  CreateFleetBikeDto,
  UpdateFleetBikeDto,
  CreateServiceEntryDto,
} from '../models/fleet-bike.model';

type ApiFleetBike = Omit<FleetBike, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

type ApiServiceEntry = Omit<ServiceEntry, 'serviceDate' | 'createdAt'> & {
  serviceDate: string;
  createdAt: string;
};

@Injectable({ providedIn: 'root' })
export class FleetTrackerService {
  private bikes = signal<FleetBike[]>([]);
  private loaded = false;
  private serviceHistory = signal<Record<string, ServiceEntry[]>>({});

  constructor(private http: HttpClient) {}

  getBikes() {
    if (!this.loaded) {
      this.loaded = true;
      this.loadBikes();
    }
    return this.bikes.asReadonly();
  }

  getServiceHistory() {
    return this.serviceHistory.asReadonly();
  }

  refreshServiceHistory(bikeId: string): void {
    this.http
      .get<ApiServiceEntry[]>(`/api/fleet/bikes/${bikeId}/service`)
      .pipe(
        map((entries) => entries.map((e) => this.fromApiServiceEntry(e))),
        catchError((err) => {
          console.error('Failed to load service history', err);
          return of([] as ServiceEntry[]);
        })
      )
      .subscribe((entries) => {
        this.serviceHistory.update((current) => ({ ...current, [bikeId]: entries }));
      });
  }

  createBike(dto: CreateFleetBikeDto): void {
    this.http
      .post<ApiFleetBike>('/api/fleet/bikes', dto)
      .pipe(
        map((bike) => this.fromApiBike(bike)),
        catchError((err) => {
          console.error('Failed to create bike', err);
          return of(null);
        })
      )
      .subscribe((bike) => {
        if (!bike) return;
        this.bikes.update((bikes) => [...bikes, bike]);
      });
  }

  updateBike(bikeId: string, dto: UpdateFleetBikeDto): void {
    this.http
      .patch<ApiFleetBike>(`/api/fleet/bikes/${bikeId}`, dto)
      .pipe(
        map((bike) => this.fromApiBike(bike)),
        catchError((err) => {
          console.error('Failed to update bike', err);
          return of(null);
        })
      )
      .subscribe((bike) => {
        if (!bike) return;
        this.bikes.update((bikes) =>
          bikes.map((item) => (item.bikeId === bikeId ? bike : item))
        );
      });
  }

  addServiceEntry(bikeId: string, dto: CreateServiceEntryDto): void {
    const payload = {
      ...dto,
      serviceDate: dto.serviceDate ? dto.serviceDate.toISOString() : undefined,
    };

    this.http
      .post<ApiServiceEntry>(`/api/fleet/bikes/${bikeId}/service`, payload)
      .pipe(
        map((entry) => this.fromApiServiceEntry(entry)),
        catchError((err) => {
          console.error('Failed to add service entry', err);
          return of(null);
        })
      )
      .subscribe((entry) => {
        if (!entry) return;
        this.serviceHistory.update((current) => {
          const existing = current[bikeId] ?? [];
          return { ...current, [bikeId]: [entry, ...existing] };
        });
      });
  }

  deleteServiceEntry(bikeId: string, serviceId: string): void {
    this.http
      .post(`/api/fleet/bikes/${bikeId}/service-delete`, { serviceId })
      .pipe(
        catchError((err) => {
          console.error('Failed to delete service entry', err);
          return of(null);
        })
      )
      .subscribe((result) => {
        if (result === null) return;
        this.serviceHistory.update((current) => {
          const entries = current[bikeId] ?? [];
          return { ...current, [bikeId]: entries.filter((e) => e.serviceId !== serviceId) };
        });
      });
  }

  deleteBike(bikeId: string): void {
    this.http
      .post(`/api/fleet/bikes/${bikeId}/delete`, {})
      .pipe(
        catchError((err) => {
          console.error('Failed to delete bike', err);
          return of(null);
        })
      )
      .subscribe((result) => {
        if (result === null) return;
        this.bikes.update((bikes) => bikes.filter((bike) => bike.bikeId !== bikeId));
        this.serviceHistory.update((current) => {
          const next = { ...current };
          delete next[bikeId];
          return next;
        });
      });
  }

  changeLocation(bikeId: string, locationId: string): void {
    this.http
      .post<ApiFleetBike>(`/api/fleet/bikes/${bikeId}/change-location`, { locationId })
      .pipe(
        map((bike) => this.fromApiBike(bike)),
        catchError((err) => {
          console.error('Failed to change location', err);
          return of(null);
        })
      )
      .subscribe((bike) => {
        if (!bike) return;
        this.bikes.update((bikes) =>
          bikes.map((item) => (item.bikeId === bikeId ? bike : item))
        );
      });
  }

  private loadBikes(): void {
    this.http
      .get<ApiFleetBike[]>('/api/fleet/bikes')
      .pipe(
        map((bikes) => bikes.map((bike) => this.fromApiBike(bike))),
        catchError((err) => {
          console.error('Failed to load bikes', err);
          return of([] as FleetBike[]);
        })
      )
      .subscribe((bikes) => this.bikes.set(bikes));
  }

  private fromApiBike(bike: ApiFleetBike): FleetBike {
    return {
      ...bike,
      createdAt: new Date(bike.createdAt),
      updatedAt: new Date(bike.updatedAt),
    };
  }

  private fromApiServiceEntry(entry: ApiServiceEntry): ServiceEntry {
    return {
      ...entry,
      serviceDate: new Date(entry.serviceDate),
      createdAt: new Date(entry.createdAt),
    };
  }
}
