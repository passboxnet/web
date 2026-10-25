/**
 * A minimal PDF writer for the Emergency Kit. It runs entirely on this
 * device, so the Secret Key never leaves it, and it avoids a large PDF
 * dependency for one A4 page of text, lines and boxes.
 *
 * Text uses the PDF standard fonts (Helvetica, Helvetica-Bold, Courier)
 * with WinAnsiEncoding, which covers German umlauts, ß, „“, – and •.
 * Coordinates are in points from the top-left corner of an A4 page.
 */

export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;

export type PdfFont = "regular" | "bold" | "mono";
export type Rgb = [number, number, number];

const FONT_NAMES: Record<PdfFont, string> = { regular: "F1", bold: "F2", mono: "F3" };

/** Helvetica advance widths (per 1000 em) for ASCII 32–126. */
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833,
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556,
  556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334,
  260, 334, 584,
];

/** Windows-1252 code points for the characters outside Latin-1 that we use. */
const WIN_ANSI: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  "„": 0x84,
  "…": 0x85,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
};

/** Encodes text as WinAnsi bytes (one char per byte); unsupported characters become "?". */
export function winAnsi(text: string): string {
  let out = "";
  for (const char of text.normalize("NFC")) {
    const code = char.codePointAt(0) ?? 63;
    if ((code >= 32 && code < 127) || (code >= 0xa0 && code <= 0xff)) out += String.fromCharCode(code);
    else if (WIN_ANSI[char] !== undefined) out += String.fromCharCode(WIN_ANSI[char]);
    else if (char === " " || char === " ") out += " ";
    else out += "?";
  }
  return out;
}

function escapePdfString(bytes: string): string {
  return bytes.replace(/[\\()]/g, (c) => `\\${c}`);
}

function charWidth(char: string, font: PdfFont): number {
  if (font === "mono") return 600;
  const base = char.normalize("NFD").charAt(0);
  const code = base.charCodeAt(0);
  const width = code >= 32 && code <= 126 ? (HELVETICA[code - 32] ?? 556) : char === "ß" ? 611 : 556;
  // Helvetica-Bold is about 5% wider on average; good enough for wrapping.
  return font === "bold" ? width * 1.06 : width;
}

/** Width of `text` in points. */
export function textWidth(text: string, size: number, font: PdfFont = "regular"): number {
  let units = 0;
  for (const char of text) units += charWidth(char, font);
  return (units * size) / 1000;
}

/**
 * Breaks text into lines no wider than `width`. Breaks at spaces; words
 * longer than a line (for example a long email address) are split anywhere.
 */
export function wrapText(text: string, width: number, size: number, font: PdfFont = "regular"): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/ +/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (textWidth(candidate, size, font) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      let rest = word;
      while (textWidth(rest, size, font) > width) {
        let cut = rest.length - 1;
        while (cut > 1 && textWidth(rest.slice(0, cut), size, font) > width) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

const num = (value: number) => (Math.round(value * 100) / 100).toString();
const color = ([r, g, b]: Rgb) => `${num(r)} ${num(g)} ${num(b)}`;

/** Collects drawing operations for one A4 page and serializes them as a PDF file. */
export class PdfPage {
  private ops: string[] = [];

  text(x: number, y: number, text: string, options: { size?: number; font?: PdfFont; color?: Rgb } = {}) {
    const { size = 11, font = "regular", color: rgb = [0, 0, 0] } = options;
    this.ops.push(
      `BT /${FONT_NAMES[font]} ${num(size)} Tf ${color(rgb)} rg ${num(x)} ${num(PAGE_HEIGHT - y)} Td (${escapePdfString(
        winAnsi(text),
      )}) Tj ET`,
    );
  }

  /** Draws wrapped text and returns the y position below it. */
  paragraph(
    x: number,
    y: number,
    width: number,
    text: string,
    options: { size?: number; font?: PdfFont; color?: Rgb; leading?: number } = {},
  ): number {
    const size = options.size ?? 11;
    const leading = options.leading ?? size * 1.4;
    let line = y;
    for (const part of wrapText(text, width, size, options.font)) {
      this.text(x, line, part, options);
      line += leading;
    }
    return line;
  }

  line(x1: number, y1: number, x2: number, y2: number, options: { width?: number; color?: Rgb; dash?: number } = {}) {
    const { width = 0.75, color: rgb = [0.6, 0.6, 0.6], dash } = options;
    this.ops.push(
      `q ${num(width)} w ${color(rgb)} RG ${dash ? `[${num(dash)} ${num(dash)}] 0 d ` : ""}${num(x1)} ${num(
        PAGE_HEIGHT - y1,
      )} m ${num(x2)} ${num(PAGE_HEIGHT - y2)} l S Q`,
    );
  }

  rect(x: number, y: number, width: number, height: number, options: { fill?: Rgb; stroke?: Rgb } = {}) {
    const box = `${num(x)} ${num(PAGE_HEIGHT - y - height)} ${num(width)} ${num(height)} re`;
    if (options.fill && options.stroke) {
      this.ops.push(`q ${color(options.fill)} rg ${color(options.stroke)} RG 0.75 w ${box} B Q`);
    } else if (options.fill) {
      this.ops.push(`q ${color(options.fill)} rg ${box} f Q`);
    } else {
      this.ops.push(`q ${color(options.stroke ?? [0, 0, 0])} RG 0.75 w ${box} S Q`);
    }
  }

  /** A rectangle with rounded corners (cubic Bézier arcs). */
  roundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    options: { fill?: Rgb; stroke?: Rgb; lineWidth?: number } = {},
  ) {
    const r = Math.min(radius, width / 2, height / 2);
    const k = r * 0.5523; // control point offset for a quarter circle
    const top = PAGE_HEIGHT - y;
    const bottom = PAGE_HEIGHT - y - height;
    const right = x + width;
    const path = [
      `${num(x + r)} ${num(top)} m`,
      `${num(right - r)} ${num(top)} l`,
      `${num(right - r + k)} ${num(top)} ${num(right)} ${num(top - r + k)} ${num(right)} ${num(top - r)} c`,
      `${num(right)} ${num(bottom + r)} l`,
      `${num(right)} ${num(bottom + r - k)} ${num(right - r + k)} ${num(bottom)} ${num(right - r)} ${num(bottom)} c`,
      `${num(x + r)} ${num(bottom)} l`,
      `${num(x + r - k)} ${num(bottom)} ${num(x)} ${num(bottom + r - k)} ${num(x)} ${num(bottom + r)} c`,
      `${num(x)} ${num(top - r)} l`,
      `${num(x)} ${num(top - r + k)} ${num(x + r - k)} ${num(top)} ${num(x + r)} ${num(top)} c`,
      "h",
    ].join(" ");
    this.paint(path, options);
  }

  /** A filled or stroked circle. */
  circle(cx: number, cy: number, radius: number, options: { fill?: Rgb; stroke?: Rgb; lineWidth?: number } = {}) {
    this.roundRect(cx - radius, cy - radius, radius * 2, radius * 2, radius, options);
  }

  /** A filled polygon through `points` (top-left coordinates). */
  polygon(points: Array<[number, number]>, fill: Rgb) {
    const [first, ...rest] = points;
    if (!first) return;
    const path = [
      `${num(first[0])} ${num(PAGE_HEIGHT - first[1])} m`,
      ...rest.map(([px, py]) => `${num(px)} ${num(PAGE_HEIGHT - py)} l`),
      "h",
    ].join(" ");
    this.paint(path, { fill });
  }

  /**
   * A horizontal gradient through `stops` (0–1 positions), drawn as thin
   * vertical strips (standard fonts and no shading objects keep the writer
   * small). Optionally clipped to a rounded rectangle of `radius`.
   */
  gradientRect(
    x: number,
    y: number,
    width: number,
    height: number,
    stops: Array<[number, Rgb]>,
    radius = 0,
    strips = 96,
  ) {
    const colorAt = (t: number): Rgb => {
      for (let i = 1; i < stops.length; i++) {
        const [p1, c1] = stops[i] as [number, Rgb];
        const [p0, c0] = stops[i - 1] as [number, Rgb];
        if (t <= p1) {
          const f = (t - p0) / (p1 - p0 || 1);
          return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
        }
      }
      return (stops[stops.length - 1] as [number, Rgb])[1];
    };
    const step = width / strips;
    const ops: string[] = ["q"];
    if (radius > 0) {
      const clip = new PdfPage();
      clip.roundRect(x, y, width, height, radius, { fill: [0, 0, 0] });
      // Reuse the path of the rounded rectangle as the clipping path.
      const path = clip.ops[0]?.replace(/^q [\d. ]+ rg /, "").replace(/ f Q$/, "") ?? "";
      ops.push(`${path} W n`);
    }
    for (let i = 0; i < strips; i++) {
      const rgb = colorAt((i + 0.5) / strips);
      // Overlap each strip a little so no hairline gaps show between them.
      ops.push(
        `${color(rgb)} rg ${num(x + i * step)} ${num(PAGE_HEIGHT - y - height)} ${num(step + 0.6)} ${num(height)} re f`,
      );
    }
    ops.push("Q");
    this.ops.push(ops.join("\n"));
  }

  private paint(path: string, { fill, stroke, lineWidth = 0.75 }: { fill?: Rgb; stroke?: Rgb; lineWidth?: number }) {
    if (fill && stroke) this.ops.push(`q ${color(fill)} rg ${color(stroke)} RG ${num(lineWidth)} w ${path} B Q`);
    else if (fill) this.ops.push(`q ${color(fill)} rg ${path} f Q`);
    else this.ops.push(`q ${color(stroke ?? [0, 0, 0])} RG ${num(lineWidth)} w ${path} S Q`);
  }

  /** Serializes the page as a complete PDF document. */
  toBytes(title: string): Uint8Array {
    const content = this.ops.join("\n");
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(PAGE_WIDTH)} ${num(PAGE_HEIGHT)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> >>`,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
      `<< /Title (${escapePdfString(winAnsi(title))}) /Producer (Passbox) >>`,
    ];
    let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
    const offsets: number[] = [];
    objects.forEach((body, index) => {
      offsets.push(out.length);
      out += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) out += `${String(offset).padStart(10, "0")} 00000 n \n`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    // Every character is a single byte (WinAnsi), so the string maps 1:1 to bytes.
    return Uint8Array.from(out, (char) => char.charCodeAt(0));
  }
}
