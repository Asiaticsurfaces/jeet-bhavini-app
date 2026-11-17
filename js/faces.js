// Face matching for "Find my photos". Runs entirely on the phone / laptop:
// selfies are never uploaded, only photographer photos get a face index.
// Library: @vladmandic/face-api (bundles TensorFlow.js), models from the same package (~12 MB, cached by the browser).
const LIB = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/dist/face-api.esm.js';
const MODELS = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model';
let kit = null;

export function load() {
  return kit ||= (async () => {
    const faceapi = await import(LIB);
    await faceapi.tf.ready();
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODELS),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODELS),
    ]);
    return faceapi;
  })().catch(e => { kit = null; throw e; });
}

// Draw any image/bitmap/canvas onto a canvas no bigger than `max` px on the long side.
function fit(src, max) {
  const w = src.naturalWidth || src.videoWidth || src.width, h = src.naturalHeight || src.videoHeight || src.height;
  const k = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c;
}

// All faces in a photo (group photos: looks at the photo at full size and in tiles so small faces are found).
export async function facesIn(src) {
  const faceapi = await load(), c = fit(src, 1600);
  const opt = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4, maxResults: 60 });
  const out = [];
  const add = list => list.forEach(d => { if (!out.some(o => faceapi.euclideanDistance(o, d.descriptor) < 0.15)) out.push(d.descriptor); });
  add(await faceapi.detectAllFaces(c, opt).withFaceLandmarks().withFaceDescriptors());
  if (Math.max(c.width, c.height) > 900) {            // 2 x 2 overlapping tiles for crowds
    const tw = Math.round(c.width * 0.6), th = Math.round(c.height * 0.6);
    for (const [x, y] of [[0, 0], [c.width - tw, 0], [0, c.height - th], [c.width - tw, c.height - th]]) {
      const t = document.createElement('canvas'); t.width = tw; t.height = th;
      t.getContext('2d').drawImage(c, x, y, tw, th, 0, 0, tw, th);
      add(await faceapi.detectAllFaces(t, opt).withFaceLandmarks().withFaceDescriptors());
    }
  }
  return out;
}

// The one face in a selfie (the biggest, if there are several).
export async function selfieFace(src) {
  const faceapi = await load(), c = fit(src, 1024);
  const all = await faceapi.detectAllFaces(c, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })).withFaceLandmarks().withFaceDescriptors();
  if (!all.length) return null;
  all.sort((a, b) => b.detection.box.area - a.detection.box.area);
  return all[0].descriptor;
}

export const encode = f32 => { const b = new Uint8Array(new Float32Array(f32).buffer); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s); };
export const decode = str => { const s = atob(str), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return new Float32Array(b.buffer); };
export const distance = (a, b) => { let t = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; t += d * d; } return Math.sqrt(t); };
export const SAME_PERSON = 0.55;   // lower = stricter (same photo ≈ 0.05, different people ≈ 0.6+)
