/**
 * App shell: creates the renderer, document store, solver, scene sync, tools
 * and UI, and runs the frame loop (ARCHITECTURE §8). The only module that
 * knows about all the others.
 *
 * Flow: pointer/key -> active tool -> command -> store -> solve -> SceneSync.
 * URL params: `?hour=18.5` start hour (deterministic screenshots),
 * `?quality=low|medium|high` post-processing preset (default high),
 * `?stress=200` a crowded benchmark base, `?empty` start with no parts, `?seed=name` terrain seed, `?golden` the fixed
 * screenshot base, `?shot` hide the HUD (screenshot sheets, see scripts/shot-sheet.js).
 */
import {
  ACESFilmicToneMapping,
  PCFShadowMap,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { snapYaw, type Vec3 } from '@/core/math';
import { emptyBase, solve, type ResolvedBase, type SolverWorld } from '@/grammar/solver';
import { allParts, getPart } from '@/grammar/registry';
import { CameraRig } from '@/render/camera-rig';
import { Lighting } from '@/render/lighting';
import { parseQuality, PostChain } from '@/render/post';
import { FIGURE_MAX_HZ } from '@/geometry/design-constants';
import { QualityGovernor } from '@/render/quality-governor';
import { SolClock } from '@/sim/clock';
import { Sim } from '@/sim/sim';
import { silhouetteSlots, slotsKey, type Slot } from '@/sim/silhouettes';
import { CrewSilhouettes } from '@/render/crew-silhouettes';
import { GRID } from '@/geometry/design-constants';
import { wearOf } from '@/grammar/solver/wear';
import { ScatterSync } from '@/render/scatter-sync';
import { SceneSync } from '@/render/scene-sync';
import { wearMap } from '@/render/shader-patches';
import { buildTerrainMesh, levelTerrainMesh } from '@/render/terrain-mesh';
import { createDocument, keepMirror, type PartId } from '@/world/document';
import { raycastTerrain, type Ray } from '@/world/raycast';
import { scatterCandidates } from '@/world/scatter';
import { generateTerrain, heightAt } from '@/world/terrain';
import { cmd } from './commands';
import { demoParts } from './demo-base';
import { goldenBase } from './golden-base';
import { stressBase } from './stress-base';
import { Ghost } from './ghost';
import { DocumentStore } from './store';
import { ConnectTool } from './tools/connect';
import { DeleteTool } from './tools/delete';
import { PlaceTool } from './tools/place';
import { SelectTool } from './tools/select';
import type { PointerInfo, Tool, ToolHost, ToolId } from './tools/tool';
import { Handles } from './ui/handles';
import { Suggestions } from './ui/suggestions';
import { Halos } from './ui/halos';
import { ParamsPanel } from './ui/params-panel';
import { Tray } from './ui/tray';

/** While nothing changes the picture is redrawn at this interval (see the frame loop). */
const IDLE_FRAME_MS = 5000;
const MAX_PIXEL_RATIO = 1.5;

export function startApp(canvas: HTMLCanvasElement): void {
  const params = new URLSearchParams(window.location.search);
  const seed = params.get('seed') ?? 'olympus-07';
  // The sol clock runs by default; an explicit `?hour=`, `?shot` or `?pause` freezes it so screenshots
  // and scripts stay deterministic.
  const startHour = Number(params.get('hour') ?? 15.5);
  const clock = new SolClock(
    startHour,
    !(params.has('hour') || params.has('shot') || params.has('pause')),
  );
  const sim = new Sim();
  let simNow = Number.NaN;
  const clockEl = document.getElementById('clock');
  let clockText = '';

  // ---- rendering ---------------------------------------------------------------
  const quality = parseQuality(params.get('quality'));
  // Every preset renders through the composer's MSAA target, so the canvas needs none.
  const renderer = new WebGLRenderer({ canvas, antialias: false });
  // Fill rate is the cost that grows with screen density; 1.5 is the cap (retina is 2, 4K laptops 2+).
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  // The shadow box is fitted to the base, so shadows only change with the hour, an edit or an animation.
  renderer.shadowMap.autoUpdate = false;

  const scene = new Scene();
  const lighting = new Lighting(scene, renderer);
  const rig = new CameraRig(canvas);
  const post = new PostChain(renderer, scene, rig.camera, quality);

  // Render-on-demand state: `wake` says the picture is stale (see the frame loop).
  let dirty = true;
  let shadowDirty = true;
  function wake(shadows = false): void {
    dirty = true;
    if (shadows) shadowDirty = true;
  }

  // ---- document, terrain, solver -----------------------------------------------
  const initial = createDocument({ seed });
  const terrain = generateTerrain({ seed, size: initial.terrain.size, cell: initial.terrain.cell });
  const terrainMesh = buildTerrainMesh(terrain);
  scene.add(terrainMesh);
  const world: SolverWorld = {
    halfSize: (terrain.size * terrain.cell) / 2,
    heightAt: (x, z) => heightAt(terrain, x, z),
  };

  const store = new DocumentStore(initial);
  const sync = new SceneSync(scene);
  const scatter = new ScatterSync(scene);
  const silhouettes = new CrewSilhouettes(scene);
  const rocks = scatterCandidates(terrain, seed);
  const gridSize = Math.round((terrain.size * terrain.cell) / GRID);
  const ghost = new Ghost(scene, world, () => store.doc);

  let movingId: PartId | null = null;
  let resolved: ResolvedBase = emptyBase();
  let terrainKey = '';
  /** The ground as drawn: natural terrain, levelled under the parts. */
  const groundAt = (): ((x: number, z: number) => number) =>
    resolved.terrain?.heightAt ?? world.heightAt;
  const resolve = (): void => {
    resolved = solve(store.doc, world, movingId ? { movingId } : {});
    sync.sync(resolved);
    wake(true);
    // The mesh follows the solver's ground, but only when a slab changed it. A dragged slab floats
    // on the natural terrain and settles when it is dropped.
    const key = resolved.terrain?.key ?? '';
    if (key !== terrainKey) {
      terrainKey = key;
      levelTerrainMesh(terrainMesh, groundAt());
    }
    // Disturbed ground around footprints and footpads; the texture is only re-sent when it changed.
    wearMap.update(wearOf(resolved, world.halfSize), world.halfSize);
    // Rocks yield to the base but stay put while a part is being dragged (SCATTER §4).
    if (!movingId) scatter.update(rocks, resolved.keepOut, gridSize, resolved.terrain);
    fitShadowToBase();
  };

  /** The shadow box covers the base (parts and their footprints), with a margin for tall parts. */
  const fitShadowToBase = (): void => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of resolved.parts.values()) {
      const reach =
        p.footprint.kind === 'rect' ? Math.hypot(p.footprint.hx, p.footprint.hz) : p.footprint.r;
      minX = Math.min(minX, p.pose.x - reach);
      maxX = Math.max(maxX, p.pose.x + reach);
      minZ = Math.min(minZ, p.pose.z - reach);
      maxZ = Math.max(maxZ, p.pose.z + reach);
    }
    if (!Number.isFinite(minX)) {
      lighting.setBounds(new Vector3(0, 0, 0), 30);
      return;
    }
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const r = Math.hypot(maxX - minX, maxZ - minZ) / 2 + 8;
    lighting.setBounds(new Vector3(cx, 3, cz), r);
  };

  if (params.has('golden')) {
    const g = goldenBase();
    let doc = initial;
    for (const p of g.parts) doc = cmd.addPart(p).apply(doc);
    for (const l of g.links) doc = cmd.addLink(l).apply(doc);
    store.reset(doc);
  } else if (params.has('stress')) {
    let doc = initial;
    for (const p of stressBase(Number(params.get('stress')) || 200))
      doc = cmd.addPart(p).apply(doc);
    store.reset(doc);
  } else if (!params.has('empty')) {
    let doc = initial;
    for (const p of demoParts()) doc = cmd.addPart(p).apply(doc);
    store.reset(doc);
  }
  if (params.has('shot')) document.body.classList.add('shot');
  resolve();

  // ---- tools ---------------------------------------------------------------------
  let selected: PartId | null = null;
  let counter = 0;

  // Suggested connections follow the part you just placed or selected (ui/suggestions.ts).
  let suggest: Suggestions | null = null;
  let focus: PartId | null = null;
  let knownParts = new Set<PartId>(Object.keys(store.doc.parts));
  const suggestFor = (): void => {
    const tool = active.id;
    const offer = !movingId && (tool === 'select' || tool === 'place');
    suggest?.request(offer && focus && store.doc.parts[focus] ? focus : null);
  };
  const tipEl = document.getElementById('tip');

  const host: ToolHost = {
    store,
    ghost,
    get selected() {
      return selected;
    },
    base: () => resolved,
    newId: () => `${Date.now().toString(36)}${(counter++).toString(36)}`,
    setTool: (id) => setTool(id),
    select: (id) => {
      selected = id;
      focus = id;
      suggestFor();
      refreshUi();
    },
    refreshUi: () => refreshUi(),
    setMoving: (id) => {
      movingId = id;
      suggestFor();
    },
    commitResolved: (id) => {
      const part = resolved.parts.get(id);
      const doc = store.doc.parts[id];
      if (!part || !doc) return;
      store.execute(
        cmd.setPose(
          id,
          keepMirror(doc.pose, { x: part.pose.x, z: part.pose.z, yaw: snapYaw(part.pose.yaw) }),
        ),
      );
    },
    tip: (text, x, y) => {
      if (!tipEl) return;
      tipEl.hidden = text === null;
      if (text !== null) {
        tipEl.textContent = text;
        tipEl.style.transform = `translate(${(x ?? 0) + 14}px, ${(y ?? 0) + 14}px)`;
      }
    },
    describe: (id) => {
      const part = resolved.parts.get(id);
      if (!part) return '';
      const name = getPart(part.letter)?.name ?? part.letter;
      const detail = getPart(part.letter)?.summary?.(part.params);
      const size = detail ? ` · ${detail}` : '';
      return `${part.letter}-${String(part.serial).padStart(3, '0')} ${name}${size}`;
    },
  };

  const halosEl = document.getElementById('halos');
  const halos = halosEl
    ? new Halos({ store, ghost, camera: rig.camera, base: () => resolved }, halosEl)
    : null;

  const suggestEl = document.getElementById('suggest');
  suggest = suggestEl
    ? new Suggestions(
        scene,
        { store, world, camera: rig.camera, base: () => resolved, wake: () => wake(true) },
        suggestEl,
      )
    : null;

  const tools: Tool[] = [
    new SelectTool(host),
    ...allParts().map((def, i) => new PlaceTool(host, def.letter, String(i + 1))),
    ...(halos ? [new ConnectTool(host, halos)] : []),
    new DeleteTool(host),
  ];
  let active: Tool = tools[0] as Tool;
  active.activate();

  function setTool(id: ToolId): void {
    const next = tools.find((t) => t.id === id);
    if (!next || next === active) return;
    switchTo(next);
  }
  function switchTo(next: Tool): void {
    active.deactivate();
    active = next;
    active.activate();
    if (next.id !== 'select' && next.id !== 'place') focus = null;
    suggestFor();
    refreshUi();
  }

  // ---- UI ------------------------------------------------------------------------
  const trayEl = document.getElementById('tray');
  const handlesEl = document.getElementById('handles');
  const tray = trayEl
    ? new Tray(
        trayEl,
        tools.map((t) => ({
          id: t.id,
          label: t.label,
          key: t.key,
          activate: () => switchTo(t),
        })),
        store,
      )
    : null;
  const handles = handlesEl
    ? new Handles(
        {
          store,
          world,
          get selected() {
            return selected;
          },
          camera: rig.camera,
          base: () => resolved,
          rayAt: (x, y) => rayAt(x, y),
          setMoving: host.setMoving,
          commitResolved: host.commitResolved,
        },
        handlesEl,
      )
    : null;

  const paramsEl = document.getElementById('params');
  const panel = paramsEl ? new ParamsPanel(paramsEl) : null;

  function refreshUi(): void {
    tray?.refresh(active);
    panel?.show(active.editor());
  }

  store.subscribe(() => {
    // Drop a selection whose part vanished (undo, delete).
    if (selected && !store.doc.parts[selected]) selected = null;
    resolve();
    active.docChanged();
    // A part that just appeared (placed, redone) becomes the focus; otherwise the selection does.
    const ids = Object.keys(store.doc.parts);
    const added = ids.filter((id) => !knownParts.has(id));
    knownParts = new Set(ids);
    if (added.length === 1 && added[0]) focus = added[0];
    else if (selected) focus = selected;
    else if (focus && !store.doc.parts[focus]) focus = null;
    suggestFor();
    refreshUi();
  });
  refreshUi();

  // ---- input ---------------------------------------------------------------------
  const raycaster = new Raycaster();
  const ndc = new Vector2();

  function rayAt(clientX: number, clientY: number): Ray {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -(((clientY - r.top) / r.height) * 2 - 1));
    raycaster.setFromCamera(ndc, rig.camera);
    const { origin, direction: d } = raycaster.ray;
    return { origin: [origin.x, origin.y, origin.z], dir: [d.x, d.y, d.z] };
  }

  function pointer(e: PointerEvent): PointerInfo {
    const ray = rayAt(e.clientX, e.clientY);
    const ground: Vec3 | null = raycastTerrain(ray, groundAt());
    return {
      ray,
      ground,
      clientX: e.clientX,
      clientY: e.clientY,
      button: e.button,
      shift: e.shiftKey,
    };
  }

  const toolPointer = (e: PointerEvent): boolean => !rig.busy && !(e.button === 0 && e.altKey);

  canvas.addEventListener('pointermove', (e) => {
    if (toolPointer(e)) active.move(pointer(e));
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (!toolPointer(e)) return;
    if (e.button === 0) canvas.setPointerCapture(e.pointerId);
    active.down(pointer(e));
  });
  canvas.addEventListener('pointerup', (e) => {
    if (e.button === 0 && canvas.hasPointerCapture(e.pointerId))
      canvas.releasePointerCapture(e.pointerId);
    active.up(pointer(e));
  });
  canvas.addEventListener('pointerleave', () => host.tip(null));

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) store.redo();
      else store.undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key === 'y') {
      e.preventDefault();
      store.redo();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (active.keydown(e)) {
      e.preventDefault();
      return;
    }
    const tool = tools.find((t) => t.key === key);
    if (tool) {
      switchTo(tool);
      return;
    }
    if (key === 'escape') {
      selected = null;
      focus = null;
      suggestFor();
      refreshUi();
    }
    if (key === 'f2') {
      // Ambient occlusion is the expensive part; this is the quick way to trade it for battery.
      post.setQuality(post.current === 'high' ? 'medium' : 'high');
      governor.enabled = false;
      wake(true);
    }
    if (key === '[') clock.scrub(-0.5);
    if (key === ']') clock.scrub(0.5);
    if (key === ' ') {
      clock.togglePause();
      e.preventDefault();
    }
    if (key === '.') clock.cycleSpeed();
    if (key === 'q') rig.rotateStep(-1);
    if (key === 'e') rig.rotateStep(1);
  });

  // ---- frame loop ----------------------------------------------------------------
  function resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    rig.resize(w, h);
    post.resize(w, h, renderer.getPixelRatio());
  }
  window.addEventListener('resize', resize);
  resize();

  // Render on demand: draw only while something changes (input, easing, an animation, an edit,
  // the hour), with a rare heartbeat while idle so a missed wake-up
  // shows up as a stale frame for a few seconds rather than forever.
  let lastRender = -Infinity;
  /** Frames actually drawn; the debug hook reads it to prove idle draws nothing. */
  let rendered = 0;
  // Without an explicit preset, step down by itself when the machine cannot keep up.
  const governor = new QualityGovernor(!params.has('quality'));
  let shownHour = Number.NaN;
  // Window silhouettes: redraw only when a figure changes pane (at most FIGURE_MAX_HZ times a second).
  let slots: Slot[] = [];
  let slotsNow = '';
  let slotsShown = '';
  let slotsBase: ResolvedBase | null = null;
  let appliedBase: ResolvedBase | null = null;
  let slotsWake = -Infinity;
  let slotsTick = -1;
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'keydown', 'keyup']) {
    // Capture phase: handle and halo drags stop propagation and hold the pointer on their own elements.
    window.addEventListener(type, () => wake(), { passive: true, capture: true });
  }
  window.addEventListener('resize', () => wake());
  document.addEventListener('visibilitychange', () => wake());
  window.addEventListener('focus', () => wake());

  function frame(now: number): void {
    requestAnimationFrame(frame);
    clock.update(now);
    // The sim ticks on its own 10 Hz step, scaled by the clock; it never asks for a frame (crew are
    // not drawn yet, and later only a redraw per sol-minute carries them).
    const simDt =
      Number.isNaN(simNow) || !clock.running ? 0 : ((now - simNow) / 1000) * clock.speed;
    simNow = now;
    sim.update(Math.min(simDt, 0.5), resolved.graph, store.doc.seed, clock.hour);
    if (sim.steps.tick !== slotsTick || slotsBase !== resolved) {
      slotsTick = sim.steps.tick;
      slots = silhouetteSlots(sim.crew, resolved);
      slotsNow = slotsKey(slots);
      slotsBase = resolved;
    }
    if (
      (slotsNow !== slotsShown || appliedBase !== resolved) &&
      now - slotsWake >= 1000 / FIGURE_MAX_HZ
    ) {
      slotsWake = now;
      wake();
    }
    // A running clock asks for a frame once per sol-minute (the sun moved), nothing more.
    const sunMoved = clock.visualHour !== shownHour;
    const gap = now - lastRender;
    if (!dirty && !sunMoved && gap < IDLE_FRAME_MS) return;
    lastRender = now;

    // After an idle stretch the first frame must not jump an animation ahead by the whole gap.
    const dt = gap > 250 ? 1 / 60 : Math.min(gap / 1000, 0.1);
    let again = rig.update(dt);
    sync.tick(dt);
    scatter.tick(dt);
    const animating = sync.animating || scatter.animating;
    again = again || animating;

    if (sunMoved) {
      shownHour = clock.visualHour;
      shadowDirty = true;
    }
    const label = `${clock.label()} ${clock.running ? `\u25b6 ${clock.speed}x` : '\u23f8'}${sim.crewCount > 0 ? ` \u00b7 crew ${sim.crewCount}` : ''}`;
    if (clockEl && label !== clockText) {
      clockText = label;
      clockEl.textContent = label;
    }
    if (slotsNow !== slotsShown || appliedBase !== resolved) {
      silhouettes.set(slots);
      slotsShown = slotsNow;
      appliedBase = resolved;
    }
    lighting.apply(clock.visualHour, rig.target);
    renderer.toneMappingExposure = lighting.exposure;
    handles?.update();
    halos?.update();
    suggest?.update();
    post.setBloomThreshold(lighting.bloomThreshold);
    if (shadowDirty || animating) renderer.shadowMap.needsUpdate = true;
    shadowDirty = false;
    post.render(dt);
    rendered++;
    // Only back-to-back frames say anything about load; the idle heartbeat is a pause.
    const slower = governor.observe(gap, post.current);
    if (slower) post.setQuality(slower);
    dirty = again;
  }
  requestAnimationFrame(frame);

  if (import.meta.env.DEV || params.has('debug')) {
    // Handle for tests and screenshot scripts; not part of the product.
    (window as unknown as Record<string, unknown>)['__regolith'] = {
      store,
      cmd,
      renderer,
      post,
      wear: wearMap,
      frames: () => rendered,
      quality: () => post.current,
      base: () => resolved,
      clock,
      sim,
      figures: () => silhouettes.count,
      setHour: (h: number) => {
        clock.set(h);
        wake(true);
      },
      rig,
      select: (id: PartId | null) => {
        selected = id;
        focus = id;
        suggestFor();
        refreshUi();
      },
      suggestions: () => suggest?.current ?? [],
    };
  }
}
