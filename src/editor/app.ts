/**
 * App shell: creates the renderer, document store, solver, scene sync, tools
 * and UI, and runs the frame loop (ARCHITECTURE §8). The only module that
 * knows about all the others.
 *
 * Flow: pointer/key -> active tool -> command -> store -> solve -> SceneSync.
 * URL params: `?hour=18.5` start hour (deterministic screenshots),
 * `?empty` start with no parts, `?seed=name` terrain seed.
 */
import {
  ACESFilmicToneMapping,
  PCFShadowMap,
  Raycaster,
  Scene,
  Timer,
  Vector2,
  WebGLRenderer,
} from 'three';
import { snapYaw, type Vec3 } from '@/core/math';
import { emptyBase, solve, type ResolvedBase, type SolverWorld } from '@/grammar/solver';
import { allParts, getPart } from '@/grammar/registry';
import { CameraRig } from '@/render/camera-rig';
import { Lighting } from '@/render/lighting';
import { SceneSync } from '@/render/scene-sync';
import { buildTerrainMesh } from '@/render/terrain-mesh';
import { createDocument, type PartId } from '@/world/document';
import { raycastTerrain, type Ray } from '@/world/raycast';
import { generateTerrain, heightAt } from '@/world/terrain';
import { cmd } from './commands';
import { demoParts } from './demo-base';
import { Ghost } from './ghost';
import { DocumentStore } from './store';
import { ConnectTool } from './tools/connect';
import { DeleteTool } from './tools/delete';
import { PlaceTool } from './tools/place';
import { SelectTool } from './tools/select';
import type { PointerInfo, Tool, ToolHost, ToolId } from './tools/tool';
import { GrowHandles } from './ui/handles';
import { Halos } from './ui/halos';
import { ParamsPanel } from './ui/params-panel';
import { Tray } from './ui/tray';

export function startApp(canvas: HTMLCanvasElement): void {
  const params = new URLSearchParams(window.location.search);
  const seed = params.get('seed') ?? 'olympus-07';
  let hour = Number(params.get('hour') ?? 15.5);
  if (!Number.isFinite(hour)) hour = 15.5;

  // ---- rendering ---------------------------------------------------------------
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  const lighting = new Lighting(scene);
  const rig = new CameraRig(canvas);

  // ---- document, terrain, solver -----------------------------------------------
  const initial = createDocument({ seed });
  const terrain = generateTerrain({ seed, size: initial.terrain.size, cell: initial.terrain.cell });
  scene.add(buildTerrainMesh(terrain));
  const world: SolverWorld = {
    halfSize: (terrain.size * terrain.cell) / 2,
    heightAt: (x, z) => heightAt(terrain, x, z),
  };

  const store = new DocumentStore(initial);
  const sync = new SceneSync(scene);
  const ghost = new Ghost(scene, world, () => store.doc);

  let movingId: PartId | null = null;
  let resolved: ResolvedBase = emptyBase();
  const resolve = (): void => {
    resolved = solve(store.doc, world, movingId ? { movingId } : {});
    sync.sync(resolved);
  };

  if (!params.has('empty')) {
    let doc = initial;
    for (const p of demoParts()) doc = cmd.addPart(p).apply(doc);
    store.reset(doc);
  }
  resolve();

  // ---- tools ---------------------------------------------------------------------
  let selected: PartId | null = null;
  let counter = 0;
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
      refreshUi();
    },
    refreshUi: () => refreshUi(),
    setMoving: (id) => {
      movingId = id;
    },
    commitResolved: (id) => {
      const part = resolved.parts.get(id);
      const doc = store.doc.parts[id];
      if (!part || !doc) return;
      store.execute(
        cmd.setPose(id, { x: part.pose.x, z: part.pose.z, yaw: snapYaw(part.pose.yaw) }),
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
    ? new GrowHandles(
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
    const ground: Vec3 | null = raycastTerrain(ray, world.heightAt);
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
      refreshUi();
    }
    if (key === '[') hour -= 0.5;
    if (key === ']') hour += 0.5;
    if (key === 'q') rig.rotateStep(-1);
    if (key === 'e') rig.rotateStep(1);
  });

  // ---- frame loop ----------------------------------------------------------------
  function resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    rig.resize(w, h);
  }
  window.addEventListener('resize', resize);
  resize();

  const timer = new Timer();
  function frame(): void {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);
    rig.update(dt);
    lighting.apply(hour, rig.target);
    handles?.update();
    halos?.update();
    renderer.render(scene, rig.camera);
    requestAnimationFrame(frame);
  }
  frame();

  if (import.meta.env.DEV || params.has('debug')) {
    // Handle for tests and screenshot scripts; not part of the product.
    (window as unknown as Record<string, unknown>)['__regolith'] = {
      store,
      cmd,
      base: () => resolved,
      setHour: (h: number) => {
        hour = h;
      },
      rig,
      select: (id: PartId | null) => {
        selected = id;
        refreshUi();
      },
    };
  }
}
