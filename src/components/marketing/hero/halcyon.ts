const VERT = `attribute vec2 position; void main(){ gl_Position = vec4(position, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
#define NRIP 28
uniform vec2  uRes, uMouse;
uniform vec2  uRipPos[NRIP];
uniform float uRipAge[NRIP];
uniform float uTime;
uniform float uHorizon, uSunX, uSunY, uSunGlow, uSunCore, uSunBright;
uniform float uCloudScale, uCloudSpeed, uCloudCover, uCloudSoft, uCloudOpac;
uniform float uRingX, uRingR, uTube, uGoldSpec, uGoldRim;
uniform float uCamH, uWaveScale, uWaveDetail, uWaveSpeed, uWaveAmp, uStretch;
uniform float uRipFreq, uRipDecay, uRipFalloff, uRipAmp;
uniform float uEdgePos, uEdgeSoft;
uniform float uReflLow, uReflHigh, uReflFall, uSparkle;
uniform float uStarBright, uStarDens, uStarAmt;
uniform float uBright, uGrain;
uniform vec3  ucSkyTop, ucSkyHorizon, ucSun, ucCloudLit, ucCloudDark, ucWaterDeep, ucGoldLight, ucGoldDark;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1,0)), c = hash(i + vec2(0,1)), d = hash(i + vec2(1,1));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++){ s += a * noise(p); p = p * 2.02 + vec2(11.3, 7.7); a *= 0.5; }
  return s;
}
float aspect(){ return uRes.x / uRes.y; }

vec3 worldColor(vec2 uv){
  float ar = aspect();
  float st = clamp((uv.y - uHorizon) / max(0.0001, 1.0 - uHorizon), 0.0, 1.0);
  vec3 col = mix(ucSkyHorizon, ucSkyTop, pow(st, 0.7));

  vec2 sun = vec2(uSunX, uSunY);
  vec2 ds = uv - sun; ds.x *= ar;
  float sd = length(ds);
  float glow = exp(-sd * sd / (uSunGlow * uSunGlow));
  float core = exp(-sd * sd / (uSunCore * uSunCore));
  col = mix(col, ucSun, glow * 0.5);
  col += ucSun * core * uSunBright;

  vec2 sp = vec2(uv.x * ar, uv.y) * uStarDens;
  vec2 scell = floor(sp);
  float sh = hash(scell);
  if (sh > 1.0 - uStarAmt) {
    vec2 sc = vec2(hash(scell + 1.7), hash(scell + 4.3));
    float sdist = length(fract(sp) - sc);
    float tw = 0.55 + 0.45 * sin(uTime * 2.5 + sh * 80.0);
    float star = smoothstep(0.12, 0.0, sdist) * tw;
    star *= smoothstep(uHorizon + 0.02, uHorizon + 0.3, uv.y);
    star *= 1.0 - glow * 0.9;
    col += star * ucSun * uStarBright;
  }

  vec2 cp = vec2(uv.x * ar, uv.y) * uCloudScale;
  cp += vec2(uTime * uCloudSpeed + uMouse.x * 0.04, -uTime * uCloudSpeed * 0.25);
  float base = fbm(cp);
  float form = fbm(cp * 2.1 + base * 1.6);
  float mask = smoothstep(uCloudCover, uCloudCover + uCloudSoft, base * 0.62 + form * 0.5);
  mask *= smoothstep(uHorizon - 0.04, uHorizon + 0.16, uv.y);
  float lit = smoothstep(0.28, 0.82, form);
  vec3 cloud = mix(ucCloudDark, ucCloudLit, lit);
  cloud = mix(cloud, ucSun, glow * 0.35);
  col = mix(col, cloud, mask * uCloudOpac);

  vec2 dr = uv - vec2(uRingX, uHorizon); dr.x *= ar;
  float rr = length(dr);
  float band = abs(rr - uRingR);
  float aa = max(1.3 / uRes.y, uTube * 0.12);
  float ring = smoothstep(uTube + aa, uTube - aa, band);
  if (ring > 0.001){
    vec2 rad = dr / max(rr, 1e-4);
    float a = clamp((rr - uRingR) / uTube, -1.0, 1.0);
    float rnd = sqrt(max(0.0, 1.0 - a * a));
    vec3 N = normalize(vec3(rad * a, rnd + 1e-4));
    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 L = normalize(vec3(normalize(sun - vec2(uRingX, uHorizon)) * 0.9, 0.55));
    vec3 Rr = reflect(-V, N);
    float upf = Rr.y;
    vec3 env = mix(ucWaterDeep * 1.3, ucSkyHorizon, smoothstep(-0.7, 0.15, upf));
    env = mix(env, ucSkyTop * 1.12, smoothstep(0.15, 0.9, upf));
    env = mix(env, ucSun, glow * 0.55);
    float envLum = dot(env, vec3(0.35, 0.4, 0.25));
    vec3 albedo = mix(ucGoldDark, ucGoldLight, 0.5 + 0.5 * upf);
    vec3 g = albedo * (0.32 + 1.05 * envLum);
    vec3 H = normalize(L + V);
    float spec = pow(max(0.0, dot(N, H)), 110.0);
    g += spec * ucSun * (1.0 + uGoldSpec);
    float sheen = pow(max(0.0, dot(N, normalize(vec3(0.0, 0.9, 0.7)))), 3.5);
    g += sheen * ucGoldLight * 0.22;
    g += pow(1.0 - rnd, 3.0) * mix(ucGoldLight, ucSun, 0.4) * uGoldRim;
    g += ucSun * core * 0.5;
    col = mix(col, g, ring);
  }
  return col;
}

vec2 waterPlane(vec2 uv){
  float ar = aspect();
  float b = max(uHorizon - uv.y, 0.0008);
  float wz = uCamH / b;
  float wx = (uv.x - 0.5) * ar * wz;
  return vec2(wx, wz);
}

float waterH(vec2 uv){
  vec2 w = waterPlane(uv);
  float wx = w.x, wz = w.y;
  float fade = 1.0 / (1.0 + wz * wz * uWaveDetail);
  float t = uTime * uWaveSpeed;
  float s = uWaveScale;
  float h = 0.0;
  h += sin((wz * 1.0 + wx * 0.15) * s - t * 1.0) * 0.55;
  h += sin((wz * 1.9 - wx * 0.40) * s - t * 1.5) * 0.32 * mix(0.5, 1.0, fade);
  h += sin((wz * 3.3 + wx * 0.85) * s - t * 2.1) * 0.18 * fade;
  h += (fbm(vec2(wx, wz) * s * 1.3 + vec2(0.0, -t * 0.6)) - 0.5) * 0.8 * fade;
  for (int i = 0; i < NRIP; i++){
    float age = uRipAge[i];
    float env = smoothstep(0.0, 0.35, age) * exp(-age * uRipDecay);
    if (env < 0.002) continue;
    float dist = length(w - uRipPos[i]);
    float clear = smoothstep(0.0, 2.5 / uRipFreq, dist);
    h += sin(dist * uRipFreq - age * uRipDecay * 4.0) * env * exp(-dist * uRipFalloff) * uRipAmp * fade * clear;
  }
  return h;
}

vec3 waterColor(vec2 uv, float ar){
  float depth = max(uHorizon - uv.y, 0.0);
  float e = 0.0016;
  float hx = waterH(uv + vec2(e, 0.0)) - waterH(uv - vec2(e, 0.0));
  float hy = waterH(uv + vec2(0.0, e)) - waterH(uv - vec2(0.0, e));
  vec2 slope = clamp(vec2(hx, hy) / (2.0 * e), -40.0, 40.0);
  float amp = uWaveAmp * (depth + 0.02);
  vec2 ruv;
  ruv.x = uv.x + slope.x * amp;
  ruv.y = uHorizon + depth * uStretch + slope.y * amp;
  vec3 refl = worldColor(ruv);
  float fres = mix(uReflLow, uReflHigh, exp(-depth * uReflFall));
  vec3 col = mix(ucWaterDeep, refl, fres);
  float lum = dot(refl, vec3(0.299, 0.587, 0.114));
  col += refl * smoothstep(0.6, 1.05, lum) * 0.6;
  float glit = pow(noise(vec2(uv.x * ar, uv.y) * 240.0 + vec2(0.0, -uTime * 3.0)), 5.0);
  col += glit * smoothstep(0.5, 0.95, lum) * ucSun * uSparkle;
  return col;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float ar = aspect();
  float center = uHorizon - uEdgePos;
  float soft   = max(uEdgeSoft, 0.0005);
  vec3 col;
  if (uv.y > center + soft) {
    col = worldColor(uv);
  } else if (uv.y < center - soft) {
    col = waterColor(uv, ar);
  } else {
    float waterMask = smoothstep(center + soft, center - soft, uv.y);
    col = mix(worldColor(uv), waterColor(uv, ar), waterMask);
  }
  float hl = exp(-abs(uv.y - center) * 60.0);
  col += hl * ucSun * 0.12 * exp(-pow((uv.x - uSunX) * 2.0, 2.0));
  col *= uBright;
  col += (hash(uv * uRes + uTime) - 0.5) * uGrain;
  gl_FragColor = vec4(pow(max(col, 0.0), vec3(1.0 / 2.2)), 1.0);
}`;

const NRIP = 28;
const RIPPLE_STEP = 0.018;
const HORIZON = 0.435;
const CAM_H = 0.1;
const SUN_CORE_REST = 0.01;
const SUN_CORE_ON = 0.294;

const FLOATS: Record<string, number> = {
  uHorizon: HORIZON, uSunX: 0.5, uSunY: 0.39, uSunGlow: 0.25, uSunBright: 1.3,
  uCloudScale: 3.2, uCloudSpeed: 0.05, uCloudCover: 0.23, uCloudSoft: 0.55, uCloudOpac: 0.23,
  uRingX: 0.495, uRingR: 0.36, uTube: 0.004, uGoldSpec: 2, uGoldRim: 1.5,
  uCamH: CAM_H, uWaveScale: 1.8, uWaveDetail: 0.92, uWaveSpeed: 0.42, uWaveAmp: 0.028, uStretch: 0.6,
  uRipFreq: 48, uRipDecay: 2.2, uRipFalloff: 3.9, uRipAmp: 0.54,
  uEdgePos: 0.035, uEdgeSoft: 0.005,
  uReflLow: 0.06, uReflHigh: 1, uReflFall: 12, uSparkle: 0,
  uStarBright: 0.98, uStarDens: 114, uStarAmt: 0.08,
  uBright: 0.95, uGrain: 0,
};

const COLORS: Record<string, string> = {
  ucSkyTop: "#000219", ucSkyHorizon: "#2a175e", ucSun: "#ff8670", ucCloudLit: "#5244bb",
  ucCloudDark: "#060057", ucWaterDeep: "#03000f", ucGoldLight: "#080042", ucGoldDark: "#140038",
};

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

export type Halcyon = { spawnRipple: (sx: number, sy: number) => void; reveal: () => void; destroy: () => void };

/** Fullscreen fragment-shader sea + sky. `sy` is bottom-up screen UV. Returns null when WebGL is unavailable. */
export function mountHalcyon(canvas: HTMLCanvasElement, reducedMotion: boolean): Halcyon | null {
  const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
  if (!gl) return null;

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(prog, "position");
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

  const loc = (n: string) => gl.getUniformLocation(prog, n);
  for (const [k, v] of Object.entries(FLOATS)) gl.uniform1f(loc(k), v);
  for (const [k, v] of Object.entries(COLORS)) gl.uniform3fv(loc(k), hex(v));

  const ripPos = new Float32Array(NRIP * 2);
  const ripAge = new Float32Array(NRIP).fill(1e3);
  const birth = new Float64Array(NRIP).fill(-1e9);
  let head = 0;
  let aspect = 1;
  let sunCore = reducedMotion ? SUN_CORE_ON : SUN_CORE_REST;
  let sunTarget = sunCore;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let last: [number, number] | null = null;
  let raf = 0;
  let prev = performance.now();

  const uRes = loc("uRes"), uMouse = loc("uMouse"), uTime = loc("uTime"), uSunCore = loc("uSunCore");
  const uRipPos = loc("uRipPos"), uRipAge = loc("uRipAge");

  const spawnRipple = (sx: number, sy: number) => {
    const b = HORIZON - sy;
    if (b <= 0.012) return;
    const wz = CAM_H / b;
    ripPos[head * 2] = (sx - 0.5) * aspect * wz;
    ripPos[head * 2 + 1] = wz;
    birth[head] = performance.now() / 1000;
    head = (head + 1) % NRIP;
  };

  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    aspect = w / Math.max(1, h);
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uRes, w, h);
  };

  const frame = () => {
    const now = performance.now();
    const dt = (now - prev) / 1000;
    prev = now;
    resize();
    const t = now / 1000;
    mouse.x += (mouse.tx - mouse.x) * 0.63;
    mouse.y += (mouse.ty - mouse.y) * 0.63;
    sunCore += (sunTarget - sunCore) * (1 - Math.exp(-dt / 0.6));
    for (let i = 0; i < NRIP; i++) ripAge[i] = t - birth[i];
    gl.uniform1f(uTime, t);
    gl.uniform1f(uSunCore, sunCore);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.uniform2fv(uRipPos, ripPos);
    gl.uniform1fv(uRipAge, ripAge);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const onMove = (e: PointerEvent) => {
    const sx = e.clientX / innerWidth, sy = 1 - e.clientY / innerHeight;
    mouse.tx = sx * 2 - 1;
    mouse.ty = sy * 2 - 1;
    if (!last || Math.hypot(sx - last[0], sy - last[1]) > RIPPLE_STEP) {
      last = [sx, sy];
      spawnRipple(sx, sy);
    }
  };

  if (reducedMotion) {
    frame();
  } else {
    const loop = () => {
      frame();
      raf = requestAnimationFrame(loop);
    };
    loop();
    window.addEventListener("pointermove", onMove, { passive: true });
  }

  return {
    spawnRipple,
    reveal: () => {
      sunTarget = SUN_CORE_ON;
    },
    destroy: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    },
  };
}
