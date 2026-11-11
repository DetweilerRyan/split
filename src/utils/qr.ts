import qrcode from 'qrcode-generator';

export interface QrSvg {
  size: number;
  path: string;
}

// Returns an SVG path (1 unit per module) plus the quiet-zone-padded size.
export function qrSvgPath(text: string, quietZone = 2): QrSvg {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  let path = '';
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) path += `M${col + quietZone} ${row + quietZone}h1v1h-1z`;
    }
  }
  return { size: count + quietZone * 2, path };
}
