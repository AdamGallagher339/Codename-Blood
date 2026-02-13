export interface FleetBike {
  bikeId: string;
  make: string;
  model: string;
  vehicleType: 'car' | 'motorcycle';
  registration: string;
  locationId: string;
  active: string;
  createdAt: Date;
  updatedAt: Date;
}

export type FleetServiceType = 'oil' | 'chain' | 'tyres' | 'brakes' | 'coolant';

export interface ServiceEntry {
  serviceId: string;
  bikeId: string;
  serviceType: FleetServiceType;
  serviceDate: Date;
  notes?: string;
  performedBy?: string;
  createdAt: Date;
}

export interface CreateFleetBikeDto {
  make: string;
  model: string;
  vehicleType: 'car' | 'motorcycle';
  registration: string;
  locationId: string;
  active: string;
}

export interface UpdateFleetBikeDto {
  make?: string;
  model?: string;
  vehicleType?: 'car' | 'motorcycle';
  registration?: string;
  locationId?: string;
  active?: string;
}

export interface CreateServiceEntryDto {
  serviceType: FleetServiceType;
  serviceDate?: Date;
  notes?: string;
  performedBy?: string;
}
