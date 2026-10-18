/**
 * Isometric-like camera: low FOV perspective at a fixed pitch, yaw snaps to
 * 45 degree stops with easing, dolly zoom, edge-free panning. Photo mode will
 * unlock the pitch later; the build view keeps it fixed so everything reads
 * the same way every time.
 */
import { MathUtils, PerspectiveCamera, Vector3 } from 'three';

export interface CameraRigOptions {
  pitchDeg?: number;
  fovDeg?: number;
  minDistance?: number;
  maxDistance?: number;
  yawSteps?: number;
}

export class CameraRig {
  readonly camera: PerspectiveCamera;
  readonly target = new Vector3(0, 0, 0);

  private yaw = Math.PI / 4;
  private yawGoal = Math.PI / 4;
  private distance = 70;
  private distanceGoal = 70;
  private readonly pitch: number;
  private readonly yawStep: number;
  private readonly minDistance: number;
  private readonly maxDistance: number;

  private dragging: 'none' | 'orbit' | 'pan' = 'none';
  private lastX = 0;
  private lastY = 0;
  private dragYaw = 0;

  constructor(
    private readonly el: HTMLElement,
    opts: CameraRigOptions = {},
  ) {
    this.pitch = MathUtils.degToRad(opts.pitchDeg ?? 38);
    this.yawStep = (Math.PI * 2) / (opts.yawSteps ?? 8);
    this.minDistance = opts.minDistance ?? 12;
    this.maxDistance = opts.maxDistance ?? 120;
    this.camera = new PerspectiveCamera(opts.fovDeg ?? 22, 1, 0.5, 400);

    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-dt * 10);
    this.yaw = MathUtils.lerp(this.yaw, this.yawGoal, k);
    this.distance = MathUtils.lerp(this.distance, this.distanceGoal, k);

    const cp = Math.cos(this.pitch);
    const offset = new Vector3(
      Math.sin(this.yaw) * cp * this.distance,
      Math.sin(this.pitch) * this.distance,
      Math.cos(this.yaw) * cp * this.distance,
    );
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
  }

  /** Is a camera drag in progress? Tools stand down while it is. */
  get busy(): boolean {
    return this.dragging !== 'none';
  }

  /** Jump the zoom (metres from the target), clamped; for screenshot scripts. */
  setDistance(metres: number): void {
    this.distanceGoal = MathUtils.clamp(metres, this.minDistance, this.maxDistance);
    this.distance = this.distanceGoal;
  }

  rotateStep(dir: 1 | -1): void {
    this.yawGoal += this.yawStep * dir;
  }

  /** Left button belongs to the editor tools; Alt+left is the laptop fallback for orbit. */
  private onDown = (e: PointerEvent): void => {
    const orbit = e.button === 1 || (e.button === 0 && e.altKey);
    const pan = e.button === 2;
    if (!orbit && !pan) return;
    this.el.setPointerCapture(e.pointerId);
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    if (orbit) {
      this.dragging = 'orbit';
      this.dragYaw = this.yawGoal;
    } else {
      this.dragging = 'pan';
    }
  };

  private onMove = (e: PointerEvent): void => {
    if (this.dragging === 'none') return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    if (this.dragging === 'orbit') {
      // Free while dragging, snaps on release.
      this.dragYaw -= dx * 0.008;
      this.yawGoal = this.dragYaw;
    } else {
      const scale = this.distance * 0.0012;
      const right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const fwd = new Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      this.target.addScaledVector(right, -dx * scale);
      this.target.addScaledVector(fwd, -dy * scale);
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (this.dragging === 'none') return;
    if (this.dragging === 'orbit') {
      this.yawGoal = Math.round(this.yawGoal / this.yawStep) * this.yawStep;
    }
    this.dragging = 'none';
    this.el.releasePointerCapture(e.pointerId);
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const f = Math.exp(e.deltaY * 0.0012);
    this.distanceGoal = MathUtils.clamp(this.distanceGoal * f, this.minDistance, this.maxDistance);
  };
}
