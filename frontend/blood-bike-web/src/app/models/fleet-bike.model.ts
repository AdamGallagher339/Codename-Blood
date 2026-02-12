export interface FleetBike {
  bikeId: string;
  model: string;
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
  bikeId: string;
  model: string;
  locationId: string;
  active: string;
}

export interface UpdateFleetBikeDto {
  model?: string;
  locationId?: string;
  active?: string;
}

export interface CreateServiceEntryDto {
  serviceType: FleetServiceType;
  serviceDate?: Date;
  notes?: string;
  performedBy?: string;
}
