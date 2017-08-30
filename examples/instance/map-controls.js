/* global THREE AFRAME */

AFRAME.registerComponent('map-controls', {

  dependencies: ['tangram-map'],

  init: function () {
    this.leafletInstance = this.el.components['tangram-map'].getLeafletInstance();
  },
  getForward: function () {
    var zaxis = new THREE.Vector3();

    return function () {
      this.el.sceneEl.camera.getWorldDirection(zaxis);
      return zaxis;
    };
  }(),
  tick: function (time, delta) {
    const forward = this.getForward();
    forward.multiplyScalar(10);

    const offset = {x: forward.x, y: -forward.y};

    this.leafletInstance.panBy(offset, {animate: false});
  }
});
