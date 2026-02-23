import { Component, ElementRef, ViewChild, AfterViewInit, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-signature-pad',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="signature-container">
      <label class="signature-label">{{ label }}</label>
      <canvas
        #signatureCanvas
        class="signature-canvas"
        (mousedown)="startDrawing($event)"
        (mousemove)="draw($event)"
        (mouseup)="stopDrawing()"
        (mouseleave)="stopDrawing()"
        (touchstart)="onTouchStart($event)"
        (touchmove)="onTouchDraw($event)"
        (touchend)="stopDrawing()"
      ></canvas>
      <div class="signature-actions">
        <button type="button" class="btn-clear" (click)="clear()">Clear</button>
        <button type="button" class="btn-confirm" (click)="confirm()" [disabled]="!hasDrawn">Confirm Signature</button>
      </div>
    </div>
  `,
  styles: [`
    .signature-container {
      width: 100%;
    }
    .signature-label {
      display: block;
      font-weight: 600;
      margin-bottom: 8px;
      color: #333;
    }
    .signature-canvas {
      width: 100%;
      height: 200px;
      border: 2px solid #ccc;
      border-radius: 8px;
      background: #fff;
      cursor: crosshair;
      touch-action: none;
      display: block;
    }
    .signature-canvas:active {
      border-color: #dc3545;
    }
    .signature-actions {
      display: flex;
      gap: 10px;
      margin-top: 10px;
      justify-content: flex-end;
    }
    .btn-clear {
      padding: 8px 20px;
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 0.95em;
      cursor: pointer;
    }
    .btn-clear:hover { background: #5a6268; }
    .btn-confirm {
      padding: 8px 20px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 0.95em;
      cursor: pointer;
      font-weight: 600;
    }
    .btn-confirm:hover:not(:disabled) { background: #c82333; }
    .btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
  `]
})
export class SignaturePadComponent implements AfterViewInit {
  @ViewChild('signatureCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() label = 'Sign below';
  @Output() signed = new EventEmitter<string>(); // emits base64 data URI

  private ctx!: CanvasRenderingContext2D;
  private isDrawing = false;
  hasDrawn = false;

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.resizeCanvas();
    this.ctx = canvas.getContext('2d')!;
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 2.5;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Handle window resize
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 2.5;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
    }
  }

  private getPos(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private getTouchPos(e: TouchEvent): { x: number; y: number } {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const touch = e.touches[0];
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }

  startDrawing(e: MouseEvent): void {
    this.isDrawing = true;
    const pos = this.getPos(e);
    this.ctx.beginPath();
    this.ctx.moveTo(pos.x, pos.y);
  }

  draw(e: MouseEvent): void {
    if (!this.isDrawing) return;
    const pos = this.getPos(e);
    this.ctx.lineTo(pos.x, pos.y);
    this.ctx.stroke();
    this.hasDrawn = true;
  }

  onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    this.isDrawing = true;
    const pos = this.getTouchPos(e);
    this.ctx.beginPath();
    this.ctx.moveTo(pos.x, pos.y);
  }

  onTouchDraw(e: TouchEvent): void {
    e.preventDefault();
    if (!this.isDrawing) return;
    const pos = this.getTouchPos(e);
    this.ctx.lineTo(pos.x, pos.y);
    this.ctx.stroke();
    this.hasDrawn = true;
  }

  stopDrawing(): void {
    this.isDrawing = false;
  }

  clear(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.hasDrawn = false;
  }

  confirm(): void {
    if (!this.hasDrawn) return;
    const dataUrl = this.canvasRef.nativeElement.toDataURL('image/png');
    this.signed.emit(dataUrl);
  }

  getDataUrl(): string {
    return this.canvasRef.nativeElement.toDataURL('image/png');
  }
}
