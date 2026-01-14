import { Component, signal, ViewChild, ElementRef, OnDestroy, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Html5Qrcode, Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';

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

  private scanner: Html5QrcodeScanner | null = null;
  private lastScanTime = 0;
  private debounceInterval = 500; // ms

  constructor(private router: Router) {}

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

    // Initialize scanner with correct types
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      remoteServerLogLevel: 'ERROR' as const,
      supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
    };

    this.scanner = new Html5QrcodeScanner('qr-reader', config, false);

    this.scanner.render(
      (decodedText) => this.onScanSuccess(decodedText),
      (error) => this.onScanError(error)
    );
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
      this.scanner.clear().catch((err) => {
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
