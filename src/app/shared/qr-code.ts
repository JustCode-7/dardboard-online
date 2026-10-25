import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnInit,
  Renderer2,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import QRCode from 'qrcode';

/**
 * Renders a QR code as an SVG element inside a container div.
 * Based on the working approach from OmniQronoCountWise: generates
 * an SVG string via QRCode.toString() and embeds it in the DOM.
 */
@Component({
  selector: 'app-qr-code',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #qrcElement [attr.aria-label]="label" role="img"></div>`,
  styleUrl: './qr-code.scss',
})
export class QrCode implements OnChanges {
  @ViewChild('qrcElement', { static: true }) qrcElement!: ElementRef;

  @Input() text: string = '';
  @Input() label: string = 'QR-Code';
  @Input() size: number = 180;

  private initialized = false;

  constructor(private renderer: Renderer2) {}

  async ngAfterViewInit(): Promise<void> {
    this.initialized = true;
    if (this.text) {
      await this.generateQR();
    }
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    // Skip initial change (text = '') and only re-render after view init
    if (!this.initialized) return;
    if (changes['text'] && this.text) {
      await this.generateQR();
    }
  }

  private async generateQR(): Promise<void> {
    if (!this.text) return;

    try {
      // Clear existing content
      const container = this.qrcElement.nativeElement;
      for (const node of container.childNodes) {
        this.renderer.removeChild(container, node);
      }

      // Generate SVG string
      const svgString = await QRCode.toString(this.text, {
        type: 'svg',
        width: this.size,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });

      // Create a temporary div to parse the SVG string
      const tempDiv = this.renderer.createElement('div');
      this.renderer.setProperty(tempDiv, 'innerHTML', svgString);

      // Get the SVG element and set dimensions
      const svgElement = tempDiv.firstChild as SVGSVGElement;
      if (svgElement) {
        this.renderer.setAttribute(svgElement, 'width', `${this.size}`);
        this.renderer.setAttribute(svgElement, 'height', `${this.size}`);
        this.renderer.appendChild(container, svgElement);
      }
    } catch {
      // Silently fail – QR code is a nice-to-have feature
    }
  }
}
