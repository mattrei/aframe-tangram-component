/* global AFRAME L Tangram */

require('leaflet');

const Utils = require('./src/utils');

if (typeof AFRAME === 'undefined') {
  throw new Error('Component attempted to register before AFRAME was available.');
}

const cuid = require('cuid');

const MAP_LOADED_EVENT = 'map-loaded';
const MAP_MOVE_END_EVENT = 'map-moveend';

function setDimensions (id, el, width, height) {
  const element = document.querySelector(`#${id}`);
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;

  el.setAttribute('material', 'width', width);
  el.setAttribute('material', 'height', height);
}

/**
 * Tangram component for A-Frame.
 */
AFRAME.registerComponent('tangram-map', {
  dependencies: [
    'geometry',
    'material'
  ],

  schema: {
    mapzenAPIKey: {
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
        /**
            [0] southwest
            [1] northeast
        */
    maxBounds: {
      default: [],
      type: 'array'
    },
    fitBounds: {
      default: [],
      type: 'array'
    },
    zoom: {
      default: 0
    },
    pxToWorldRatio: {
      default: 100
    },
    canvasOffsetPx: {
      default: 9999 // debug
    }
  },

  multiple: false,

  init: function () {
    this.creatingMap = false;
    this._mapInstance = null;
    this._scene = null;

    this._initMap();
  },
  update: function (oldData) {
    var self = this;

        // Nothing changed
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

    // if (!AFRAME.utils.deepEqual(oldData.maxBounds, this.data.maxBounds)) {
    if (oldData.maxBounds !== this.data.maxBounds) {
      this._mapInstance.setMaxBounds(L.latLngBounds(this.data.maxBounds));
    }

    var moved = false;
        // if (!AFRAME.utils.deepEqual(oldData.center, this.data.center)) {
    if (oldData.center !== this.data.center) {
      moved = true;
      this._mapInstance.setView(Utils.latLonFrom(this.data.center), this.data.zoom);
    }

        // if (!AFRAME.utils.deepEqual(oldData.fitBounds, this.data.fitBounds)) {
    if (this.data.fitBounds.length > 0 && oldData.fitBounds !== this.data.fitBounds) {
      moved = true;
      this._mapInstance.fitBounds(L.latLngBounds(this.data.fitBounds));
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
            width, height, data.canvasOffsetPx);

    var map = L.map(canvasContainer, Utils.leafletOptions);

    const sceneStyle = Utils.processStyle(this.data.style);

    var layer = Tangram.leafletLayer({
      scene: {
        import: sceneStyle,
        global: {
          sdk_mapzen_api_key: data.mapzenAPIKey
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
        const canvasId = document.querySelector(`#${_canvasContainerId} canvas`).id;
        self.el.setAttribute('material', 'src', `#${canvasId}`);
        self.el.emit(MAP_LOADED_EVENT);
      }
    });
    layer.addTo(map);

    this._mapInstance = map;
  },
  remove: function () {},

  tick: function (delta, time) {},

  project (lon, lat) {
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

  unproject (x, y) {
        // The 3D world size of the entity
    const el = this.el.components.geometry.data;

    // Converting back to pixel space
    const pxX = (x + (el.width / 2)) * this.data.pxToWorldRatio;
        // y-coord is inverted (positive up in world space, positive down in
        // pixel space)
    const pxY = ((el.height / 2) - y) * this.data.pxToWorldRatio;

        // Return the lat / long of that pixel on the map
    var latLng = this._mapInstance.layerPointToLatLng([pxX, pxY]);
    return {
      lon: latLng.lng,
      lat: latLng.lat
    };
  }
});
