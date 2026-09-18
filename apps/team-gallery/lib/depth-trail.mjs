import * as THREE from 'three';
import { TrailController } from './codrops/TrailController.mjs';

// Same world scale as Codrops: five units between frames, 45° camera.
export const TRAIL_CAMERA_START = 5;
export const TRAIL_FRAME_GAP = 5;
export function trailCameraZ(progress) {
  return (
    TRAIL_CAMERA_START - Math.max(0, Math.min(5, progress)) * TRAIL_FRAME_GAP
  );
}
export function createDepthTrail(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, TRAIL_CAMERA_START);
  const controller = new TrailController({ gallery: null });
  const bounds = {
    maxCameraZ: TRAIL_CAMERA_START,
    minCameraZ: trailCameraZ(5),
  };
  controller.init(scene, camera);
  let disposed = false,
    previousTime = 0,
    wasReduced = false;
  return {
    resize(width, height, scale = 1) {
      if (disposed) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      // Stage CSS scales the canvas too; render at the actual screen density.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * scale);
      renderer.setSize(width, height, false);
    },
    update(progress, pointer, time, reduced) {
      if (disposed) return;
      canvas.style.visibility = reduced ? 'hidden' : 'visible';
      if (reduced) {
        wasReduced = true;
        return;
      }
      if (wasReduced) {
        controller.trail.reset();
        controller.trailHeadParticles.clear();
        controller.runtimeState.previousProgress = null;
        wasReduced = false;
      }
      camera.position.z = trailCameraZ(progress);
      camera.updateMatrixWorld();
      // Original trail tuning is authored for 60Hz; cap geometry rebuilds on 120Hz screens.
      const steps = Math.floor((time - previousTime + 0.001) / (1000 / 60));
      if (steps >= 1 || previousTime === 0) {
        controller.update(camera, bounds, time);
        previousTime =
          previousTime === 0 ? time : previousTime + steps * (1000 / 60);
      }
      controller.trail.object.position.set(
        pointer.x * 0.1,
        -pointer.y * 0.05,
        0,
      );
      controller.trailHeadParticles.object.position.copy(
        controller.trail.object.position,
      );
      renderer.render(scene, camera);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      controller.dispose();
      controller.timer.dispose();
      scene.clear();
      renderer.dispose();
    },
  };
}
