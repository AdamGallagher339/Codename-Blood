import { Component, signal, ViewChild, ElementRef, OnDestroy, Output, EventEmitter, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Html5Qrcode } from 'html5-qrcode';

@Component({
  selector: 'app-qr-scanner',
  imports: [CommonModule],
  templateUrl: './qr-scanner.component.html',
  styleUrl: './qr-scanner.component.scss'
})
export class QrScannerComponent implements OnDestroy {
  @ViewChild('qrReader') qrReader!: ElementRef<HTMLDivElement>;
  @Output() scanComplete = new EventEmitter<string>();
  @Input() returnUrl = '/';

  isScanning = signal(false);
  scanResult = signal<string | null>(null);
  error = signal<string | null>(null);

  private scanner: Html5Qrcode | null = null;
  private lastScanTime = 0;
  private debounceInterval = 500; // ms

  constructor(private router: Router, private cdr: ChangeDetectorRef) {}

  startScan(): void {
    this.isScanning.set(true);
    this.error.set(null);
    this.scanResult.set(null);
    this.lastScanTime = 0;

    // Check browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.error.set('Camera access is not supported on this browser. Please use Chrome, Firefox, or Safari.');
      this.isScanning.set(false);
      return;
    }

    // Wait for DOM to update before initializing scanner
    this.cdr.detectChanges();
    
    setTimeout(() => {
      this.scanner = new Html5Qrcode('qr-reader');

      this.scanner.start(
        { facingMode: 'environment' },   // rear camera for scanning physical QR codes
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => this.onScanSuccess(decodedText),
        (error: string) => this.onScanError(error)
      ).catch((err: unknown) => {
        console.error('Failed to start scanner:', err);
        this.error.set('Failed to start camera. Please check permissions and try again.');
        this.isScanning.set(false);
      });
    }, 0);
  }

  private onScanSuccess(decodedText: string): void {
    const now = Date.now();
    
    // Debounce: prevent multiple scans within interval
    if (now - this.lastScanTime < this.debounceInterval) {
      return;
    }
    
    this.lastScanTime = now;
    console.log('QR Code scanned:', decodedText);
    
    this.scanResult.set(decodedText);
    this.stopScan();
    this.scanComplete.emit(decodedText);
  }

  private onScanError(error: string): void {
    // Suppress repeated permission errors
    if (error.includes('Permission denied') || error.includes('NotAllowedError')) {
      if (!this.error()) {
        this.error.set('Camera permission denied. Please allow camera access to scan QR codes.');
      }
      this.isScanning.set(false);
    } else if (error.includes('NotFoundError')) {
      if (!this.error()) {
        this.error.set('No camera found. Please connect a camera device.');
      }
      this.isScanning.set(false);
    }
    // Ignore other errors (like "No QR code found") - these are expected during scanning
  }

  stopScan(): void {
    if (this.scanner) {
      this.scanner.stop().catch((err: unknown) => {
        console.log('Error stopping scanner:', err);
      });
      this.scanner = null;
    }
    this.isScanning.set(false);
  }

  returnWithResult(): void {
    if (this.scanResult()) {
      // If called from a form/input context, emit the result
      this.scanComplete.emit(this.scanResult()!);
    }
    this.router.navigate([this.returnUrl]);
  }

  cancel(): void {
    this.stopScan();
    this.router.navigate([this.returnUrl]);
  }

  ngOnDestroy(): void {
    this.stopScan();
  }
}
