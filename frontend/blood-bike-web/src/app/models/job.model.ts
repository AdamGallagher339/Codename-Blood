export interface Job {
  jobId: string;
  title: string;
  status: JobStatus;
  createdBy: string;
  acceptedBy: string;
  pickup: JobLocation;
  dropoff: JobLocation;
  timestamps: JobTimestamps;
}

export interface JobLocation {
  address?: string;
  lat?: number;
  lng?: number;
  signature?: string;   // base64 PNG of rider signature
  signedAt?: string;     // ISO timestamp of signing
}

export interface JobTimestamps {
  created?: string;
  updated?: string;
  pickedUp?: string;
  delivered?: string;
}

export type JobStatus = 'open' | 'accepted' | 'picked-up' | 'delivered' | 'completed' | 'cancelled';

export interface ReceiptRequest {
  jobId: string;
  type: 'pickup' | 'delivery';
  recipientEmail: string;
  riderName: string;
  signatureData: string;  // base64 data URI
  jobTitle: string;
  pickupAddress: string;
  dropoffAddress: string;
  timestamp: string;
}

export interface ReceiptResponse {
  sent: boolean;
  message: string;
  html?: string;
}

export interface SavedContact {
  name: string;
  email: string;
}
