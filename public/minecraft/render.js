'use strict';
// ---------------------------------------------------------------- WebGL renderer

const Renderer = {
  gl: null, canvas: null,
  proj: Mat4.identity(), view: Mat4.identity(), pv: Mat4.identity(),
  lights: new Float32Array(32 * 4), numLights: 0,

  init(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    // ---------- chunk / entity shader ----------
    const vs = `#version 300 es
    precision highp float;
    layout(location=0) in vec3 aPos;
    layout(location=1) in vec2 aUV;
    layout(location=2) in float aLight;
    uniform mat4 uPV;
    uniform vec3 uOffset;
    uniform float uTime;
    uniform int uWave;
    out vec2 vUV; out float vLight; out vec3 vWorld;
    void main() {
      vec3 p = aPos + uOffset;
      if (uWave == 1) p.y += sin(uTime * 2.0 + p.x * 0.7 + p.z * 0.9) * 0.045 - 0.02;
      vWorld = p;
      vUV = aUV; vLight = aLight;
      gl_Position = uPV * vec4(p, 1.0);
    }`;
    const fs = `#version 300 es
    precision highp float;
    in vec2 vUV; in float vLight; in vec3 vWorld;
    uniform sampler2D uTex;
    uniform float uAmbient;         // day factor 0..1
    uniform vec3 uFogColor;
    uniform float uFogDist;
    uniform vec3 uCam;
    uniform float uAlpha;
    uniform int uNumLights;
    uniform vec4 uLights[32];       // xyz, intensity
    out vec4 fragColor;
    void main() {
      vec4 tex = texture(uTex, vUV);
      if (tex.a < 0.4) discard;
      float sky = vLight * mix(0.14, 1.0, uAmbient);
      float pt = 0.0;
      for (int i = 0; i < 32; i++) {
        if (i >= uNumLights) break;
        vec3 L = uLights[i].xyz - vWorld;
        float d = length(L);
        pt = max(pt, uLights[i].w * clamp(1.0 - d / 12.0, 0.0, 1.0));
      }
      float light = clamp(max(sky, pt * 0.95), 0.02, 1.25);
      vec3 col = tex.rgb * light;
      // warm tint from torchlight
      col += vec3(0.20, 0.10, 0.0) * pt * tex.rgb;
      float fog = clamp((distance(uCam.xz, vWorld.xz) - uFogDist * 0.62) / (uFogDist * 0.38), 0.0, 1.0);
      col = mix(col, uFogColor, fog);
      fragColor = vec4(col, tex.a * uAlpha);
    }`;
    this.chunkProg = this.program(vs, fs);

    // ---------- sky shader (fullscreen) ----------
    const svs = `#version 300 es
    precision highp float;
    layout(location=0) in vec2 aPos;
    uniform mat4 uInvPV;
    out vec3 vDir;
    void main() {
      gl_Position = vec4(aPos, 0.9999, 1.0);
      vec4 p = uInvPV * vec4(aPos, 1.0, 1.0);
      vDir = p.xyz / p.w;
    }`;
    const sfs = `#version 300 es
    precision highp float;
    in vec3 vDir;
    uniform vec3 uSunDir;
    uniform float uDay;      // 0..1
    uniform vec3 uZenith; uniform vec3 uHorizon;
    out vec4 fragColor;
    float hash(vec3 p){ p = fract(p*0.3183099+vec3(0.1,0.2,0.3)); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    void main() {
      vec3 d = normalize(vDir);
      float t = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
      vec3 col = mix(uHorizon, uZenith, pow(t, 0.8));
      // sun
      float s = dot(d, uSunDir);
      col += vec3(1.0, 0.85, 0.5) * smoothstep(0.9985, 0.9995, s) * 1.2;
      col += vec3(1.0, 0.6, 0.25) * pow(max(s, 0.0), 48.0) * 0.35 * uDay;
      // moon
      float m = dot(d, -uSunDir);
      col += vec3(0.9, 0.93, 1.0) * smoothstep(0.9991, 0.9997, m) * 0.9;
      // stars
      if (uDay < 0.35 && d.y > 0.0) {
        vec3 sp = floor(d * 220.0);
        float st = step(0.9985, hash(sp));
        col += vec3(st) * (0.35 - uDay) * 2.2 * (0.5 + 0.5 * hash(sp + 1.0));
      }
      fragColor = vec4(col, 1.0);
    }`;
    this.skyProg = this.program(svs, sfs);

    // ---------- clouds ----------
    const cvs = `#version 300 es
    precision highp float;
    layout(location=0) in vec2 aPos;
    uniform mat4 uPV; uniform vec3 uCam;
    out vec2 vXZ;
    void main() {
      vec2 xz = uCam.xz + aPos * 420.0;
      vXZ = xz;
      gl_Position = uPV * vec4(xz.x, 108.0, xz.y, 1.0);
    }`;
    const cfs = `#version 300 es
    precision highp float;
    in vec2 vXZ;
    uniform float uTime; uniform float uDay; uniform vec3 uCam;
    out vec4 fragColor;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
    void main() {
      vec2 p = vXZ * 0.011 + vec2(uTime * 0.008, 0.0);
      float c = n2(p) * 0.6 + n2(p * 2.0) * 0.4;
      float a = smoothstep(0.58, 0.72, c) * 0.55;
      float dist = distance(uCam.xz, vXZ);
      a *= 1.0 - smoothstep(260.0, 400.0, dist);
      vec3 col = mix(vec3(0.25, 0.28, 0.38), vec3(1.0), uDay);
      fragColor = vec4(col, a);
    }`;
    this.cloudProg = this.program(cvs, cfs);

    // ---------- flat colored (outline, arrows etc) ----------
    const fvs = `#version 300 es
    precision highp float;
    layout(location=0) in vec3 aPos;
    uniform mat4 uPV;
    void main(){ gl_Position = uPV * vec4(aPos, 1.0); }`;
    const ffs = `#version 300 es
    precision highp float;
    uniform vec4 uColor;
    out vec4 fragColor;
    void main(){ fragColor = uColor; }`;
    this.flatProg = this.program(fvs, ffs);

    // atlas texture
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.atlasTex = tex;

    // fullscreen quad
    this.fsq = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fsq);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,-1, 1,1, -1,1]), gl.STATIC_DRAW);

    // dynamic entity/particle buffers
    this.entBuf = gl.createBuffer();
    this.partBuf = gl.createBuffer();
    this.lineBuf = gl.createBuffer();
    this.crackBuf = gl.createBuffer();
    this.resize();
  },

  program(vsSrc, fsSrc) {
    const gl = this.gl;
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error('shader: ' + gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error('link: ' + gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  },

  resize() {
    const gl = this.gl, c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.floor(c.clientWidth * dpr), h = Math.floor(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    gl.viewport(0, 0, w, h);
  },

  uploadChunk(c, data) {
    const gl = this.gl;
    if (!c.mesh) c.mesh = { solid: gl.createBuffer(), water: gl.createBuffer(), nSolid: 0, nWater: 0 };
    gl.bindBuffer(gl.ARRAY_BUFFER, c.mesh.solid);
    gl.bufferData(gl.ARRAY_BUFFER, data.solid, gl.STATIC_DRAW);
    c.mesh.nSolid = data.solid.length / 6;
    gl.bindBuffer(gl.ARRAY_BUFFER, c.mesh.water);
    gl.bufferData(gl.ARRAY_BUFFER, data.water, gl.STATIC_DRAW);
    c.mesh.nWater = data.water.length / 6;
  },
  dropChunk(c) {
    if (c.mesh) {
      this.gl.deleteBuffer(c.mesh.solid);
      this.gl.deleteBuffer(c.mesh.water);
      c.mesh = null;
    }
  },

  bindChunkAttribs() {
    const gl = this.gl;
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 12);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 24, 20);
  },

  // main render
  frame(S) {
    // S: {world, cam:{x,y,z,pitch,yaw}, day, sunDir, fogColor, zenith, horizon,
    //     time, entVerts, partVerts, outline, crackVerts, underwater}
    const gl = this.gl;
    this.resize();
    const aspect = this.canvas.width / this.canvas.height;
    Mat4.perspective(this.proj, (S.underwater ? 65 : 72) * Math.PI / 180, aspect, 0.08, 460);
    Mat4.fpsView(this.view, S.cam.x, S.cam.y, S.cam.z, S.cam.pitch, S.cam.yaw);
    Mat4.multiply(this.pv, this.proj, this.view);
    const planes = frustumPlanes(this.pv);

    const fc = S.fogColor;
    gl.clearColor(fc[0], fc[1], fc[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // ---------- sky ----------
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.skyProg.p);
    // inverse of pv for direction reconstruction: build from view rotation only
    const inv = this.invPV();
    gl.uniformMatrix4fv(this.skyProg.u.uInvPV, false, inv);
    gl.uniform3f(this.skyProg.u.uSunDir, S.sunDir[0], S.sunDir[1], S.sunDir[2]);
    gl.uniform1f(this.skyProg.u.uDay, S.day);
    gl.uniform3fv(this.skyProg.u.uZenith, S.zenith);
    gl.uniform3fv(this.skyProg.u.uHorizon, S.horizon);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fsq);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.enable(gl.DEPTH_TEST);

    // ---------- chunks (solid) ----------
    const cp = this.chunkProg;
    gl.useProgram(cp.p);
    gl.uniformMatrix4fv(cp.u.uPV, false, this.pv);
    gl.uniform1f(cp.u.uAmbient, S.day);
    gl.uniform3fv(cp.u.uFogColor, fc);
    gl.uniform1f(cp.u.uFogDist, S.underwater ? 30 : VIEW_R * CHUNK);
    gl.uniform3f(cp.u.uCam, S.cam.x, S.cam.y, S.cam.z);
    gl.uniform1f(cp.u.uTime, S.time);
    gl.uniform1f(cp.u.uAlpha, 1);
    gl.uniform1i(cp.u.uWave, 0);
    gl.uniform1i(cp.u.uNumLights, this.numLights);
    gl.uniform4fv(cp.u.uLights, this.lights);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.uniform1i(cp.u.uTex, 0);

    const visible = [];
    for (const c of S.world.chunks.values()) {
      if (!c.mesh || !c.populated) continue;
      const x0 = c.cx * CHUNK, z0 = c.cz * CHUNK;
      if (!boxInFrustum(planes, x0, 0, z0, x0 + CHUNK, WORLD_H, z0 + CHUNK)) continue;
      visible.push(c);
    }
    for (const c of visible) {
      if (!c.mesh.nSolid) continue;
      gl.uniform3f(cp.u.uOffset, c.cx * CHUNK, 0, c.cz * CHUNK);
      gl.bindBuffer(gl.ARRAY_BUFFER, c.mesh.solid);
      this.bindChunkAttribs();
      gl.drawArrays(gl.TRIANGLES, 0, c.mesh.nSolid);
    }

    // ---------- entities ----------
    if (S.entVerts && S.entVerts.length) {
      gl.uniform3f(cp.u.uOffset, 0, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.entBuf);
      gl.bufferData(gl.ARRAY_BUFFER, S.entVerts, gl.DYNAMIC_DRAW);
      this.bindChunkAttribs();
      gl.disable(gl.CULL_FACE);
      gl.drawArrays(gl.TRIANGLES, 0, S.entVerts.length / 6);
      gl.enable(gl.CULL_FACE);
    }

    // ---------- crack overlay ----------
    if (S.crackVerts && S.crackVerts.length) {
      gl.uniform3f(cp.u.uOffset, 0, 0, 0);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(-1, -2);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.crackBuf);
      gl.bufferData(gl.ARRAY_BUFFER, S.crackVerts, gl.DYNAMIC_DRAW);
      this.bindChunkAttribs();
      gl.drawArrays(gl.TRIANGLES, 0, S.crackVerts.length / 6);
      gl.disable(gl.BLEND);
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }

    // ---------- particles ----------
    if (S.partVerts && S.partVerts.length) {
      gl.uniform3f(cp.u.uOffset, 0, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
      gl.bufferData(gl.ARRAY_BUFFER, S.partVerts, gl.DYNAMIC_DRAW);
      this.bindChunkAttribs();
      gl.disable(gl.CULL_FACE);
      gl.drawArrays(gl.TRIANGLES, 0, S.partVerts.length / 6);
      gl.enable(gl.CULL_FACE);
    }

    // ---------- water (translucent) ----------
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniform1i(cp.u.uWave, 1);
    gl.uniform1f(cp.u.uAlpha, 0.8);
    gl.disable(gl.CULL_FACE);
    for (const c of visible) {
      if (!c.mesh.nWater) continue;
      gl.uniform3f(cp.u.uOffset, c.cx * CHUNK, 0, c.cz * CHUNK);
      gl.bindBuffer(gl.ARRAY_BUFFER, c.mesh.water);
      this.bindChunkAttribs();
      gl.drawArrays(gl.TRIANGLES, 0, c.mesh.nWater);
    }
    gl.enable(gl.CULL_FACE);
    gl.uniform1i(cp.u.uWave, 0);
    gl.uniform1f(cp.u.uAlpha, 1);

    // ---------- clouds ----------
    gl.useProgram(this.cloudProg.p);
    gl.uniformMatrix4fv(this.cloudProg.u.uPV, false, this.pv);
    gl.uniform3f(this.cloudProg.u.uCam, S.cam.x, S.cam.y, S.cam.z);
    gl.uniform1f(this.cloudProg.u.uTime, S.time);
    gl.uniform1f(this.cloudProg.u.uDay, S.day);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fsq);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2);
    gl.disable(gl.CULL_FACE);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    // ---------- first-person hand (drawn over everything) ----------
    if (S.handVerts && S.handVerts.length) {
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(cp.p);
      gl.uniform3f(cp.u.uOffset, 0, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.entBuf2 || (this.entBuf2 = gl.createBuffer()));
      gl.bufferData(gl.ARRAY_BUFFER, S.handVerts, gl.DYNAMIC_DRAW);
      this.bindChunkAttribs();
      gl.disable(gl.CULL_FACE);
      gl.drawArrays(gl.TRIANGLES, 0, S.handVerts.length / 6);
      gl.enable(gl.CULL_FACE);
    }

    // ---------- block outline ----------
    if (S.outline) {
      const [bx, by, bz] = S.outline;
      const e = 0.003;
      const x0 = bx - e, y0 = by - e, z0 = bz - e, x1 = bx + 1 + e, y1 = by + 1 + e, z1 = bz + 1 + e;
      const L = [
        x0,y0,z0, x1,y0,z0,  x1,y0,z0, x1,y0,z1,  x1,y0,z1, x0,y0,z1,  x0,y0,z1, x0,y0,z0,
        x0,y1,z0, x1,y1,z0,  x1,y1,z0, x1,y1,z1,  x1,y1,z1, x0,y1,z1,  x0,y1,z1, x0,y1,z0,
        x0,y0,z0, x0,y1,z0,  x1,y0,z0, x1,y1,z0,  x1,y0,z1, x1,y1,z1,  x0,y0,z1, x0,y1,z1,
      ];
      gl.useProgram(this.flatProg.p);
      gl.uniformMatrix4fv(this.flatProg.u.uPV, false, this.pv);
      gl.uniform4f(this.flatProg.u.uColor, 0.05, 0.05, 0.05, 0.85);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(L), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2);
      gl.drawArrays(gl.LINES, 0, L.length / 3);
    }
  },

  invPV() {
    // invert rotation-only pv for sky ray directions: use transpose of view rotation and inverse projection
    const v = this.view, p = this.proj;
    // rotation part transposed
    const r = [
      v[0], v[1], v[2],
      v[4], v[5], v[6],
      v[8], v[9], v[10]];
    const fx = 1 / p[0], fy = 1 / p[5];
    // dir_view = (x*fx, y*fy, -1); dir_world = R^T * dir_view
    // encode as matrix multiplying (x, y, 1, 1)
    const out = new Float32Array(16);
    // column 0: fx * R^T col for x
    out[0] = r[0] * fx; out[1] = r[3] * fx; out[2] = r[6] * fx; out[3] = 0;
    out[4] = r[1] * fy; out[5] = r[4] * fy; out[6] = r[7] * fy; out[7] = 0;
    out[8] = -r[2]; out[9] = -r[5]; out[10] = -r[8]; out[11] = 0;
    out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
    return out;
  },

  setLights(list) {
    this.numLights = Math.min(32, list.length);
    for (let i = 0; i < this.numLights; i++) {
      this.lights[i * 4] = list[i][0];
      this.lights[i * 4 + 1] = list[i][1];
      this.lights[i * 4 + 2] = list[i][2];
      this.lights[i * 4 + 3] = list[i][3];
    }
  },
};
