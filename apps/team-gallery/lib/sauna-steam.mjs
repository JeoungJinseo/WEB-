import * as THREE from 'three';
import { SteamRibbon } from './steam-ribbon.mjs';
import { saunaCameraZ } from './sauna-motion.mjs';

export function createSaunaSteam(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  const ribbon = new SteamRibbon();
  scene.add(ribbon.object);
  let disposed = false;
  return {
    resize(width, height, scale = 1) {
      if (disposed) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * scale);
      renderer.setSize(width, height, false);
    },
    update(progress, pointer, time, reduced) {
      if (disposed) return;
      canvas.style.visibility = reduced ? 'hidden' : 'visible';
      ribbon.update(progress, camera.aspect, time, pointer, reduced);
      if (reduced) return;
      camera.position.z = saunaCameraZ(progress);
      camera.updateMatrixWorld();
      renderer.render(scene, camera);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      ribbon.dispose();
      scene.clear();
      renderer.dispose();
    },
  };
}
