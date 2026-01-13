import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink } from '@angular/router';
import { EventsPageComponent } from './components/events-page.component';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterLink, EventsPageComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  currentPage = 'home';
  showSettings = false;
  
  pages = [
    { id: 'map', title: 'Map', icon: '🗺️' },
    { id: 'riders', title: 'Rider Login', icon: '🚴' },
    { id: 'scanner', title: 'QR Scanner', icon: '📱' },
    { id: 'events', title: 'Events', icon: '📅' },
    { id: 'communications', title: 'Messages', icon: '💬' }
  ];

  navigateTo(pageId: string): void {
    this.currentPage = pageId;
    this.showSettings = false;
  }

  toggleSettings(): void {
    this.showSettings = !this.showSettings;
  }

  closeSettings(): void {
    this.showSettings = false;
  }

  goBack(): void {
    this.currentPage = 'home';
    this.showSettings = false;
  }
}
