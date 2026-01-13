import { Component, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CreateEventDto, EventType, EventPriority } from '../models/event.model';

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './event-form.component.html',
  styleUrl: './event-form.component.scss'
})
export class EventFormComponent {
  showModal = signal(false);
  
  eventCreated = output<CreateEventDto>();
  modalClosed = output<void>();
  
  // Form fields
  title = signal('');
  description = signal('');
  date = signal(this.getTodayString());
  startTime = signal('09:00');
  endTime = signal('10:00');
  location = signal('');
  type = signal<EventType>(EventType.DELIVERY);
  priority = signal<EventPriority>(EventPriority.MEDIUM);
  
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
    this.modalClosed.emit();
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
      priority: this.priority()
    };
    
    this.eventCreated.emit(eventDto);
    this.close();
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
