import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FleetTrackerService } from '../services/fleet-tracker.service';
import { AuthService } from '../services/auth.service';
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
  private authService = inject(AuthService);

  bikes = this.fleetService.getBikes();
  serviceHistory = this.fleetService.getServiceHistory();

  selectedBikeId = signal<string | null>(null);
  selectedBike = computed(() =>
    this.bikes().find((bike) => bike.bikeId === this.selectedBikeId()) ?? null
  );

  // UI state
  showAddForm = signal(false);
  activeTab = signal<'details' | 'service' | 'remove'>('details');
  activeBikeCount = computed(() =>
    this.bikes().filter(b => b.active !== 'out_of_service').length
  );

  // Create bike form
  make = signal('');
  model = signal('');
  vehicleType = signal<'car' | 'motorcycle'>('motorcycle');
  registration = signal('');
  locationId = signal('');
  // Status is auto-set to out_of_service on creation (no user choice)

  // Edit bike form
  editMake = signal('');
  editModel = signal('');
  editVehicleType = signal<'car' | 'motorcycle'>('motorcycle');
  editRegistration = signal('');
  editLocationId = signal('');
  editActiveMode = signal<'ready' | 'out_of_service'>('out_of_service');

  deleteConfirm = signal('');
  deleteMatchesRegistration = computed(() => {
    const bike = this.selectedBike();
    if (!bike) return false;
    return this.deleteConfirm().trim() === bike.registration;
  });

  // Service history form
  serviceType = signal<FleetServiceType>('oil');
  serviceDate = signal(this.getTodayString());
  serviceNotes = signal('');
  servicePerformedBy = signal(this.authService.username());

  selectBike(bikeId: string): void {
    this.selectedBikeId.set(bikeId);
    const bike = this.bikes().find((item) => item.bikeId === bikeId);
    if (bike) {
      this.editMake.set(bike.make);
      this.editModel.set(bike.model);
      this.editVehicleType.set(bike.vehicleType);
      this.editRegistration.set(bike.registration);
      this.editLocationId.set(bike.locationId);
      if (bike.active === 'out_of_service') {
        this.editActiveMode.set('out_of_service');
      } else {
        this.editActiveMode.set('ready');
      }
      this.deleteConfirm.set('');
      this.activeTab.set('details');
      this.fleetService.refreshServiceHistory(bikeId);
    }
  }

  createBike(): void {
    if (
      !this.make().trim() ||
      !this.model().trim() ||
      !this.registration().trim() ||
      !this.locationId().trim()
    ) {
      return;
    }

    this.fleetService.createBike({
      make: this.make().trim(),
      model: this.model().trim(),
      vehicleType: this.vehicleType(),
      registration: this.registration().trim(),
      locationId: this.locationId().trim(),
      active: 'out_of_service'
    });

    this.make.set('');
    this.model.set('');
    this.vehicleType.set('motorcycle');
    this.registration.set('');
    this.locationId.set('');
    this.showAddForm.set(false);
  }

  saveBike(): void {
    const bike = this.selectedBike();
    if (!bike) return;

    this.fleetService.updateBike(bike.bikeId, {
      active: this.editActiveMode(),
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
    this.servicePerformedBy.set(this.authService.username());
  }

  deleteServiceEntry(bikeId: string, serviceId: string): void {
    this.fleetService.deleteServiceEntry(bikeId, serviceId);
  }

  deleteBike(): void {
    const bike = this.selectedBike();
    if (!bike) return;
    if (!this.deleteMatchesRegistration()) return;

    this.fleetService.deleteBike(bike.bikeId);
    this.selectedBikeId.set(null);
    this.deleteConfirm.set('');
  }

  formatActive(value: string): string {
    if (value === 'ready') return 'Ready';
    if (value === 'out_of_service') return 'Out of service';
    // legacy off_duty values
    if (value === 'off_duty') return 'Ready';
    return `Rider ${value}`;
  }

  private getTodayString(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
