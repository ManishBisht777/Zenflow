// Loop export: MP4/WebM via MediaRecorder, or a zip of PNG frames. Both render offscreen at 30 fps.
type DrawFrame = (context: CanvasRenderingContext2D, timeMs: number) => void;
const FPS = 30;

export function download(blob: Blob, fileName: string) {
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = fileName;
  document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 4000);
}

const createSquareCanvas = (size: number) => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = size; return canvas; };
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function exportVideo(drawFrame: DrawFrame, loopMs: number, size: number, mimeType: string, onProgress: (percent: number) => void, fileName: string) {
  const canvas = createSquareCanvas(size), context = canvas.getContext('2d')!, stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 14e6 }), chunks: Blob[] = [];
  recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise(resolve => { recorder.onstop = resolve; });
  drawFrame(context, 0); recorder.start();
  const frameCount = Math.round(loopMs / 1000 * FPS), startedAt = performance.now();
  for (let i = 0; i < frameCount; i++) {
    drawFrame(context, i * 1000 / FPS);
    if (track.requestFrame) track.requestFrame();
    if (i % 15 === 0) onProgress(Math.round(i / frameCount * 100));
    // real-time pacing: MediaRecorder timestamps frames by wall clock
    await wait(Math.max(0, startedAt + (i + 1) * 1000 / FPS - performance.now()));
  }
  recorder.stop(); await stopped;
  const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
  download(new Blob(chunks, { type: mimeType.split(';')[0] }), `${fileName}.${extension}`);
  return { extension, frameCount };
}

export async function exportFrames(drawFrame: DrawFrame, loopMs: number, size: number, onProgress: (percent: number) => void, fileName: string) {
  const canvas = createSquareCanvas(size), context = canvas.getContext('2d')!, frameCount = Math.round(loopMs / 1000 * FPS);
  const files: { name: string; data: Uint8Array }[] = [];
  for (let i = 0; i < frameCount; i++) {
    drawFrame(context, i * 1000 / FPS);
    const png = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    files.push({ name: `frame_${String(i + 1).padStart(4, '0')}.png`, data: new Uint8Array(await png!.arrayBuffer()) });
    if (i % 10 === 0) onProgress(Math.round(i / frameCount * 100));
  }
  download(zipWithoutCompression(files), `${fileName}-frames.zip`);
  return frameCount;
}

let crcTable: Uint32Array | null = null;
const crc32 = (data: Uint8Array) => {
  const table = crcTable || (crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })());
  let c = 0xFFFFFFFF; for (let i = 0; i < data.length; i++) c = table[(c ^ data[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
};

// store-only zip (PNGs are already compressed): local headers + data, then the central directory, then the end record
function zipWithoutCompression(files: { name: string; data: Uint8Array }[]) {
  const encoder = new TextEncoder(), body: BlobPart[] = [], directory: BlobPart[] = [];
  let offset = 0, directorySize = 0;
  for (const file of files) {
    const name = encoder.encode(file.name), crc = crc32(file.data), size = file.data.length;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(8, 0, true); local.setUint16(12, 33, true);
    local.setUint32(14, crc, true); local.setUint32(18, size, true); local.setUint32(22, size, true); local.setUint16(26, name.length, true);
    body.push(local.buffer, name as BlobPart, file.data as BlobPart);
    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true); entry.setUint16(4, 20, true); entry.setUint16(6, 20, true); entry.setUint16(14, 33, true);
    entry.setUint32(16, crc, true); entry.setUint32(20, size, true); entry.setUint32(24, size, true); entry.setUint16(28, name.length, true); entry.setUint32(42, offset, true);
    directory.push(entry.buffer, name as BlobPart);
    offset += 30 + name.length + size; directorySize += 46 + name.length;
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, directorySize, true); end.setUint32(16, offset, true);
  return new Blob([...body, ...directory, end.buffer], { type: 'application/zip' });
}
