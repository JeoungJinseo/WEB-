import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TrailController } from '../lib/codrops/TrailController.mjs';
import { trailCameraZ } from '../lib/depth-trail.mjs';
const bounds = { maxCameraZ: 5, minCameraZ: -20 };
function setup() {
  const camera = new THREE.PerspectiveCamera(45, 1440 / 1024, 0.1, 100);
  camera.position.z = 5;
  const scene = new THREE.Scene(),
    controller = new TrailController({ gallery: null });
  controller.init(scene, camera);
  return { camera, scene, controller };
}
test('trail shares the exact gallery camera depth for all six frames', () => {
  for (let frame = 0; frame < 6; frame++)
    assert.equal(trailCameraZ(frame), 5 - frame * 5);
});
test('native reference trail remains finite and within the point budget throughout travel', () => {
  const { camera, controller } = setup();
  for (let i = 0; i <= 180; i++) {
    camera.position.z = trailCameraZ(i / 36);
    controller.update(camera, bounds, (i * 1000) / 60);
    assert.ok(controller.trail.points.length <= 220);
    const head = controller.trailHeadPosition;
    assert.ok([head.x, head.y, head.z].every(Number.isFinite));
    assert.ok(camera.position.z - head.z > 0.1);
  }
  const geometry = controller.trail.mesh?.geometry;
  assert.ok(geometry);
  assert.ok(
    Array.from(geometry.attributes.position.array).every(Number.isFinite),
  );
  controller.dispose();
  controller.timer.dispose();
});
test('reversing resets the trail to a short local segment without spanning distant frames', () => {
  const { camera, controller } = setup();
  for (let i = 0; i < 100; i++) {
    camera.position.z = trailCameraZ(i / 40);
    controller.update(camera, bounds, i * 17);
  }
  camera.position.z = trailCameraZ(2.3);
  controller.update(camera, bounds, 1700);
  assert.equal(controller.runtimeState.previousDirection, -1);
  assert.ok(controller.trail.points.length <= 2);
  assert.ok(
    controller.trail.points[0].distanceTo(controller.trail.points[1]) < 1,
  );
  controller.dispose();
  controller.timer.dispose();
});
test('particles fade away and geometry is released on teardown', () => {
  const { camera, controller } = setup();
  controller.update(camera, bounds, 100);
  controller.update(camera, bounds, 150);
  assert.ok(
    controller.trailHeadParticles.particles.some((p) => p.lifeRemaining > 0),
  );
  controller.trailHeadParticles.update(1, new THREE.Vector3(), 0, false);
  controller.dispose();
  assert.equal(controller.trail.mesh, null);
  assert.equal(controller.trail.points.length, 0);
  assert.equal(controller.trailHeadParticles.particles.length, 0);
  controller.timer.dispose();
});
