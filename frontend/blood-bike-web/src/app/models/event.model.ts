export interface Event {
  id: string;
  title: string;
  description: string;
  date: Date;
  startTime: string;
  endTime: string;
  location: string;
  type: EventType;
  priority: EventPriority;
  assignedRiders?: string[];
  status: EventStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum EventType {
  DELIVERY = 'delivery',
  TRAINING = 'training',
  MAINTENANCE = 'maintenance',
  MEETING = 'meeting',
  EMERGENCY = 'emergency',
  OTHER = 'other'
}

export enum EventPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum EventStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export interface CreateEventDto {
  title: string;
  description: string;
  date: Date;
  startTime: string;
  endTime: string;
  location: string;
  type: EventType;
  priority: EventPriority;
  assignedRiders?: string[];
}
