/* global AFRAME */

const Tangram = require('tangram');
const L = require('leaflet');

const Utils = require('./src/utils');

if (typeof AFRAME === 'undefined') {
  throw new Error('Component attempted to register before AFRAME was available.');
}

const cuid = require('cuid');

const MAP_LOADED_EVENT = 'tangram-map-loaded';
const MAP_MOVE_END_EVENT = 'tangram-map-moveend';

function setDimensions (id, el, width, height) {
  const element = document.querySelector('#' + id);
  element.style.width = width + 'px';
  element.style.height = height + 'px';

  el.setAttribute('material', 'width', width);
  el.setAttribute('material', 'height', height);
}

const DEBUG_CANVAS_OFFSET = 99999;

/**
 * Tangram component for A-Frame.
 */
AFRAME.registerComponent('tangram-map', {
  dependencies: [
    'geometry',
    'material'
  ],

  schema: {
    apiKey: {
      default: ''
    },
    style: {
      type: 'asset',
      default: ''
    },
    center: {
      // lon lat
      default: [0, 0],
      type: 'array'
    },
    zoom: {
      default: 0
    },
    pxToWorldRatio: {
      default: 100
    }
  },

  multiple: false,

  init: function () {
    this.creatingMap = false;
    this._mapInstance = null;
    this._layer = null;

    this._initMap();
  },
  update: function (oldData) {
    var self = this;

    if (AFRAME.utils.deepEqual(oldData, this.data)) {
      return;
    }

    if (oldData.pxToWorldRatio !== this.data.pxToWorldRatio) {
      const geomComponent = this.el.components.geometry;
      const width = geomComponent.data.width * this.data.pxToWorldRatio;
      const height = geomComponent.data.height * this.data.pxToWorldRatio;
      setDimensions(this._canvasContainerId, this.el, width, height);
    }

    // Everything after this requires a map instance
    if (!this._mapInstance) {
      return;
    }

    var moved = false;
    if (oldData.center !== this.data.center) {
      moved = true;
      this._mapInstance.setView(Utils.latLonFrom(this.data.center), this.data.zoom);
    }

    if (moved) {
      // A way to signal when these async actions have completed
      this._mapInstance.once('moveend', function (evt) {
        self.el.emit(MAP_MOVE_END_EVENT);
      });
    }
  },
  _initMap: function () {
    var data = this.data;
    var self = this;

    const geomComponent = this.el.components.geometry;
    var width = geomComponent.data.width * this.data.pxToWorldRatio;
    var height = geomComponent.data.height * this.data.pxToWorldRatio;

    const _canvasContainerId = cuid();
    this._canvasContainerId = _canvasContainerId;
    const canvasContainer = Utils.getCanvasContainerAssetElement(_canvasContainerId,
            width, height, DEBUG_CANVAS_OFFSET);

    var map = L.map(canvasContainer, Utils.leafletOptions);

    const sceneStyle = this.data.style;

    var layer = Tangram.leafletLayer({
      scene: {
        import: sceneStyle,
        global: {
          sdk_mapzen_api_key: data.apiKey
        }
      },
      webGLContextOptions: {
        preserveDrawingBuffer: true
      },
      attribution: ''
    });
    layer.scene.subscribe({
      load: function () {
        Utils.processCanvasElement(canvasContainer);
      },
      view_complete: function () {
        const canvasId = document.querySelector('#' + _canvasContainerId + ' canvas').id;
        self.el.setAttribute('material', 'src', '#' + canvasId);
        self.el.emit(MAP_LOADED_EVENT);
      }
    });
    layer.addTo(map);

    this._mapInstance = map;
    this._layer = layer;
  },
  remove: function () {
    // TODO
    this._layer.remove();
  },

  tick: function (delta, time) {},

  project: function (lon, lat) {
    var px = this._mapInstance.latLngToLayerPoint([lat, lon]);

    const el = this.el.components.geometry.data;

    return {
      x: (px.x / this.data.pxToWorldRatio) - (el.width / 2),
            // y-coord is inverted (positive up in world space, positive down in
            // pixel space)
      y: -(px.y / this.data.pxToWorldRatio) + (el.height / 2),
      z: 0
    };
  },

  unproject: function (x, y) {
        // The 3D world size of the entity
    const el = this.el.components.geometry.data;

    // Converting back to pixel space
    const pxX = (x + (el.width / 2)) * this.data.pxToWorldRatio;
    const pxY = ((el.height / 2) - y) * this.data.pxToWorldRatio;

    // Return the lat / long of that pixel on the map
    var latLng = this._mapInstance.layerPointToLatLng([pxX, pxY]);
    return {
      lon: latLng.lng,
      lat: latLng.lat
    };
  },

  getMap: function () {
    return this._mapInstance;
  }
});

AFRAME.registerPrimitive('a-tangram-map', {
  // Defaults the terrain to be parallel to the ground.
  defaultComponents: {
    geometry: {
      primitive: 'plane'
    },
    material: {
      wireframe: false,
      transparent: true,
      side: 'both',
      shader: 'flat',
      color: '#ffffff'
    },
    'tangram-map': {}
  },
  mappings: {
    'api-key': 'tangram-map.apiKey',
    'map-style': 'tangram-map.style',
    zoom: 'tangram-map.zoom',
    center: 'tangram-map.center',
    'px-world-ratio': 'tangram-map.pxToWorldRatio',
    height: 'geometry.height',
    width: 'geometry.width'

  }
});
