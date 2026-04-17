import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import {
  FleetBike,
  ServiceEntry,
  CreateFleetBikeDto,
  UpdateFleetBikeDto,
  CreateServiceEntryDto,
} from '../models/fleet-bike.model';
import { NotificationService } from './notification.service';

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
  private notifications = inject(NotificationService);

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
          this.notifications.warning('Service history could not be refreshed.', 'fleet:history');
          return of(null);
        })
      )
      .subscribe((entries) => {
        if (!entries) return;
        this.serviceHistory.update((current) => ({ ...current, [bikeId]: entries }));
      });
  }

  createBike(dto: CreateFleetBikeDto): Observable<boolean> {
    return this.http
      .post<ApiFleetBike>('/api/fleet/bikes', dto)
      .pipe(
        map((bike) => this.fromApiBike(bike)),
        tap((bike) => {
          this.bikes.update((bikes) => [...bikes, bike]);
        }),
        map(() => true),
        catchError((err) => {
          console.error('Failed to create bike', err);
          this.notifications.error('Could not add the vehicle.', 'fleet:create-bike');
          return of(false);
        })
      );
  }

  updateBike(bikeId: string, dto: UpdateFleetBikeDto): Observable<boolean> {
    return this.http
      .patch<ApiFleetBike>(`/api/fleet/bikes/${bikeId}`, dto)
      .pipe(
        map((bike) => this.fromApiBike(bike)),
        tap((bike) => {
          this.bikes.update((bikes) =>
            bikes.map((item) => (item.bikeId === bikeId ? bike : item))
          );
        }),
        map(() => true),
        catchError((err) => {
          console.error('Failed to update bike', err);
          this.notifications.error('Could not update the vehicle status.', 'fleet:update-bike');
          return of(false);
        })
      );
  }

  addServiceEntry(bikeId: string, dto: CreateServiceEntryDto): Observable<boolean> {
    const payload = {
      ...dto,
      serviceDate: dto.serviceDate ? dto.serviceDate.toISOString() : undefined,
    };

    return this.http
      .post<ApiServiceEntry>(`/api/fleet/bikes/${bikeId}/service`, payload)
      .pipe(
        map((entry) => this.fromApiServiceEntry(entry)),
        tap((entry) => {
          this.serviceHistory.update((current) => {
            const existing = current[bikeId] ?? [];
            return { ...current, [bikeId]: [entry, ...existing] };
          });
        }),
        map(() => true),
        catchError((err) => {
          console.error('Failed to add service entry', err);
          this.notifications.error('Could not save the service record.', 'fleet:add-service');
          return of(false);
        })
      );
  }

  deleteServiceEntry(bikeId: string, serviceId: string): Observable<boolean> {
    return this.http
      .post(`/api/fleet/bikes/${bikeId}/service-delete`, { serviceId })
      .pipe(
        tap(() => {
          this.serviceHistory.update((current) => {
            const entries = current[bikeId] ?? [];
            return { ...current, [bikeId]: entries.filter((e) => e.serviceId !== serviceId) };
          });
        }),
        map(() => true),
        catchError((err) => {
          console.error('Failed to delete service entry', err);
          this.notifications.error('Could not delete the service record.', 'fleet:delete-service');
          return of(false);
        })
      );
  }

  deleteBike(bikeId: string): Observable<boolean> {
    return this.http
      .post(`/api/fleet/bikes/${bikeId}/delete`, {})
      .pipe(
        tap(() => {
          this.bikes.update((bikes) => bikes.filter((bike) => bike.bikeId !== bikeId));
          this.serviceHistory.update((current) => {
            const next = { ...current };
            delete next[bikeId];
            return next;
          });
        }),
        map(() => true),
        catchError((err) => {
          console.error('Failed to delete bike', err);
          this.notifications.error('Could not delete the vehicle.', 'fleet:delete-bike');
          return of(false);
        })
      );
  }

  changeLocation(bikeId: string, locationId: string): Observable<boolean> {
    return this.http
      .post<ApiFleetBike>(`/api/fleet/bikes/${bikeId}/change-location`, { locationId })
      .pipe(
        map((bike) => this.fromApiBike(bike)),
        tap((bike) => {
          this.bikes.update((bikes) =>
            bikes.map((item) => (item.bikeId === bikeId ? bike : item))
          );
        }),
        map(() => true),
        catchError((err) => {
          console.error('Failed to change location', err);
          this.notifications.error('Could not change the vehicle location.', 'fleet:change-location');
          return of(false);
        })
      );
  }

  private loadBikes(): void {
    this.http
      .get<ApiFleetBike[]>('/api/fleet/bikes')
      .pipe(
        map((bikes) => bikes.map((bike) => this.fromApiBike(bike))),
        catchError((err) => {
          console.error('Failed to load bikes', err);
          this.notifications.warning('Fleet data could not be refreshed.', 'fleet:load');
          return of(null);
        })
      )
      .subscribe((bikes) => {
        if (!bikes) return;
        this.bikes.set(bikes);
      });
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
