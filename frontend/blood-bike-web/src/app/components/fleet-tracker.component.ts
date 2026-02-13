import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FleetTrackerService } from '../services/fleet-tracker.service';
import { FleetServiceType } from '../models/fleet-bike.model';

@Component({
  selector: 'app-fleet-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fleet-tracker.component.html',
  styleUrl: './fleet-tracker.component.scss'
})
export class FleetTrackerComponent {
  private fleetService = inject(FleetTrackerService);

  bikes = this.fleetService.getBikes();
  serviceHistory = this.fleetService.getServiceHistory();

  selectedBikeId = signal<string | null>(null);
  selectedBike = computed(() =>
    this.bikes().find((bike) => bike.bikeId === this.selectedBikeId()) ?? null
  );

  // Create bike form
  make = signal('');
  model = signal('');
  vehicleType = signal<'car' | 'motorcycle'>('motorcycle');
  registration = signal('');
  locationId = signal('');
  activeMode = signal<'off_duty' | 'out_of_service' | 'rider'>('off_duty');
  activeRiderId = signal('');

  // Edit bike form
  editMake = signal('');
  editModel = signal('');
  editVehicleType = signal<'car' | 'motorcycle'>('motorcycle');
  editRegistration = signal('');
  editLocationId = signal('');
  editActiveMode = signal<'off_duty' | 'out_of_service' | 'rider'>('off_duty');
  editActiveRiderId = signal('');

  // Service history form
  serviceType = signal<FleetServiceType>('oil');
  serviceDate = signal(this.getTodayString());
  serviceNotes = signal('');
  servicePerformedBy = signal('');

  selectBike(bikeId: string): void {
    this.selectedBikeId.set(bikeId);
    const bike = this.bikes().find((item) => item.bikeId === bikeId);
    if (bike) {
      this.editMake.set(bike.make);
      this.editModel.set(bike.model);
      this.editVehicleType.set(bike.vehicleType);
      this.editRegistration.set(bike.registration);
      this.editLocationId.set(bike.locationId);
      if (bike.active === 'off_duty' || bike.active === 'out_of_service') {
        this.editActiveMode.set(bike.active);
        this.editActiveRiderId.set('');
      } else {
        this.editActiveMode.set('rider');
        this.editActiveRiderId.set(bike.active);
      }
      this.fleetService.refreshServiceHistory(bikeId);
    }
  }

  createBike(): void {
    const active = this.resolveActiveValue(this.activeMode(), this.activeRiderId());
    if (
      !this.make().trim() ||
      !this.model().trim() ||
      !this.registration().trim() ||
      !this.locationId().trim() ||
      !active
    ) {
      return;
    }

    this.fleetService.createBike({
      make: this.make().trim(),
      model: this.model().trim(),
      vehicleType: this.vehicleType(),
      registration: this.registration().trim(),
      locationId: this.locationId().trim(),
      active
    });

    this.make.set('');
    this.model.set('');
    this.vehicleType.set('motorcycle');
    this.registration.set('');
    this.locationId.set('');
    this.activeMode.set('off_duty');
    this.activeRiderId.set('');
  }

  saveBike(): void {
    const bike = this.selectedBike();
    if (!bike) return;

    const active = this.resolveActiveValue(this.editActiveMode(), this.editActiveRiderId());
    if (
      !this.editMake().trim() ||
      !this.editModel().trim() ||
      !this.editRegistration().trim() ||
      !this.editLocationId().trim() ||
      !active
    ) {
      return;
    }

    this.fleetService.updateBike(bike.bikeId, {
      make: this.editMake().trim(),
      model: this.editModel().trim(),
      vehicleType: this.editVehicleType(),
      registration: this.editRegistration().trim(),
      locationId: this.editLocationId().trim(),
      active,
    });
  }

  addServiceEntry(): void {
    const bike = this.selectedBike();
    if (!bike) return;

    this.fleetService.addServiceEntry(bike.bikeId, {
      serviceType: this.serviceType(),
      serviceDate: new Date(this.serviceDate()),
      notes: this.serviceNotes().trim() || undefined,
      performedBy: this.servicePerformedBy().trim() || undefined,
    });

    this.serviceNotes.set('');
    this.servicePerformedBy.set('');
  }

  formatActive(value: string): string {
    if (value === 'off_duty') return 'Off duty';
    if (value === 'out_of_service') return 'Out of service';
    return `Rider ${value}`;
  }

  private resolveActiveValue(mode: 'off_duty' | 'out_of_service' | 'rider', riderId: string): string {
    if (mode === 'rider') {
      return riderId.trim();
    }
    return mode;
  }

  private getTodayString(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
