// Loop export: MP4/WebM via MediaRecorder, rendered offscreen at 30 fps.
type DrawFrame = (context: CanvasRenderingContext2D, timeMs: number) => void;
const FPS = 30;

export function download(blob: Blob, fileName: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
}

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function exportVideo(
  drawFrame: DrawFrame,
  loopMs: number,
  width: number,
  height: number,
  mimeType: string,
  onProgress: (percent: number) => void,
  fileName: string,
) {
  const canvas = createCanvas(width, height),
    context = canvas.getContext("2d")!,
    stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 14e6,
    }),
    chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise((resolve) => {
    recorder.onstop = resolve;
  });
  drawFrame(context, 0);
  recorder.start();
  const frameCount = Math.round((loopMs / 1000) * FPS),
    startedAt = performance.now();
  for (let i = 0; i < frameCount; i++) {
    drawFrame(context, (i * 1000) / FPS);
    if (track.requestFrame) track.requestFrame();
    if (i % 15 === 0) onProgress(Math.round((i / frameCount) * 100));
    // real-time pacing: MediaRecorder timestamps frames by wall clock
    await wait(
      Math.max(0, startedAt + ((i + 1) * 1000) / FPS - performance.now()),
    );
  }
  recorder.stop();
  await stopped;
  const extension = mimeType.includes("mp4") ? "mp4" : "webm";
  download(
    new Blob(chunks, { type: mimeType.split(";")[0] }),
    `${fileName}.${extension}`,
  );
  return { extension, frameCount };
}
