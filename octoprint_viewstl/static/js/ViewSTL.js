$(function () {
  function ViewSTLViewModel(parameters) {
    var self = this;

    self.files = parameters[0].listHelper;
    self.FileList = ko.observableArray();
    self.RenderModes = ko.observableArray([{
            name : 'solid',
            value : 'false'
          }, {
            name : 'wireframe',
            value : 'true'
          }
        ]);

    self.canvas = document.getElementById('viewstl');
    self.viewer = new JSC3D.Viewer(self.canvas);
    self.models = document.getElementById('viewlstl_file_list');
    self.modes = document.getElementById('viewstl_render_mode');

    self.setRenderMode = function () {
      self.viewer.setRenderMode(self.modes[self.modes.selectedIndex].value);
      self.viewer.update();
    };

    self.loadModel = function () {
      var hash = self.models[self.models.selectedIndex].value;
      if (hash != "") {
        var model = self.findModel(hash);
        self.viewer.replaceSceneFromUrl(model.refs.download);
        self.viewer.setRenderMode(self.modes[self.modes.selectedIndex].value);
        self.viewer.update();
      }
    };

    // find model by hash
    self.findModel = function(hash) {
      var model = self.files.getItem(function(item){return item.hash == hash});
      return model;
    }

    // This will get called before the ViewSTLViewModel gets bound to the DOM, but after its depedencies have
    // already been initialized. It is especially guaranteed that this method gets called _after_ the settings
    // have been retrieved from the OctoPrint backend and thus the SettingsViewModel been properly populated.
    self.onBeforeBinding = function () {
      self.FileList(_.filter(self.files.allItems, self.files.supportedFilters["model"]));
      self.viewer.setParameter('RenderMode', 'smooth');
      self.viewer.init();
      self.viewer.update();
    };

    //resize canvas after ViewSTL tab is made active.
    self.onTabChange = function (current, previous) {
      if (current == "#tab_plugin_viewstl") {
        self.resiveCanvas();
        self.updateFileList();
      }
    };

    //append file list with newly updated stl file.
    self.onEventUpload = function (file) {
      if (file.file.substr(file.file.length - 3).toLowerCase() == "stl") {
        self.FileList.push({
          name : file.file
        });
      }
    };

    self.updateFileList = function () {
      self.FileList(_.filter(self.files.allItems, self.files.supportedFilters["model"]));
    };

    self.resiveCanvas = function(){
          $('canvas#viewstl').width($('div#tab_plugin_viewstl').width());
        };
  }

  // This is how our plugin registers itself with the application, by adding some configuration information to
  // the global variable ADDITIONAL_VIEWMODELS
  ADDITIONAL_VIEWMODELS.push([
      // This is the constructor to call for instantiating the plugin
      ViewSTLViewModel,

      // This is a list of dependencies to inject into the plugin, the order which you request here is the order
      // in which the dependencies will be injected into your view model upon instantiation via the parameters
      // argument
      ["gcodeFilesViewModel"],

      // Finally, this is the list of all elements we want this view model to be bound to.
      [("#tab_plugin_viewstl")]
    ]);
});



var camera, scene, renderer, mesh, cube;

var materialOptions = {
  //wireframe: true,
  color: 0x1989ff,
  overdraw: 0.5
}

var fov = 50;
var aspect = window.innerWidth / window.innerHeight;

var debug = false;

if ( ! Detector.webgl ) Detector.addGetWebGLMessage();
initViewSTL();
animate();


function initViewSTL() {

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera( fov, aspect , 1, 10000 );
  camera.position.x = 100;
  camera.position.y = 100;
  camera.position.z = 200;
  scene.add( camera );

  var hemisphereLight = new THREE.HemisphereLight( 0xf0f0f0, 0x040404, 1 );
  scene.add( hemisphereLight );

  var directionalLight = new THREE.DirectionalLight( 0x404040 );
  directionalLight.position.x = 0; 
  directionalLight.position.y = 0; 
  directionalLight.position.z = 1; 
  directionalLight.position.normalize();
  scene.add( directionalLight );

  var geometry = new THREE.PlaneBufferGeometry( 2000, 2000, 100, 100 );
  geometry.rotateX( - Math.PI / 2 );
  var material = new THREE.MeshBasicMaterial( { color: 0xaaaaaa, wireframe: true, overdraw: 0.5} );
  plane = new THREE.Mesh( geometry, material );
  scene.add( plane );

  if(debug == true) {
    var geometry = new THREE.BoxGeometry( 10, 10, 10 );
    var material = new THREE.MeshBasicMaterial( { color: 0xff0000 } );
    cube = new THREE.Mesh( geometry, material );
    scene.add( cube );
  }

  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function () {
    if ( xhr.readyState == 4 ) {
      if ( xhr.status == 200 || xhr.status == 0 ) {
        var rep = xhr.response; // || xhr.mozResponseArrayBuffer;
        var dataView = new DataView(rep);
        var decoder = new TextDecoder('utf-8');
        var decodedString = decoder.decode(dataView);
        if (decodedString.match(/[^\u0000-\u007f]/)) {
          parseStlBinary(rep);
        } else {
          parseStl(decodedString);
        }            
      }
    }
  }
  xhr.onerror = function(e) {
    console.log(e);
  }
  
  //xhr.open( "GET", 'ascii.stl', true );
  //xhr.open( "GET", 'binary.stl', true );
  //xhr.open( "GET", 'cube.stl', true );
  xhr.open( "GET", 'mask.stl', true );
  //xhr.open( "GET", 'nerf.stl', true );
  xhr.responseType = "arraybuffer";
  xhr.send( null );

  renderer = new THREE.WebGLRenderer(); //new THREE.CanvasRenderer();
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.setClearColor( 0xe0e0e0 );

  controls = new THREE.OrbitControls( camera, renderer.domElement );
  controls.enableDamping = true;
  controls.dampingFactor = 0.25;
  controls.enableZoom = true;

  document.body.appendChild( renderer.domElement );

}

function getCenterPoint(mesh) {
    var center = new THREE.Vector3();
    var bb = new THREE.BoundingBoxHelper(mesh, 0xff0000);
    bb.update();
    center.x = (bb.box.max.x + bb.box.min.x) / 2;
    center.y = (bb.box.max.y + bb.box.min.y) / 2;
    center.z = (bb.box.max.z + bb.box.min.z) / 2;
    if(debug == true) {
      scene.add(bb);      
    }
    return center;
}

function getDistanceFactor(mesh) {
  var geometry = mesh.geometry;
  geometry.computeBoundingSphere();
  var radius = geometry.boundingSphere.radius;
  return Math.abs( aspect * radius / Math.sin( fov/2 ))/1200;
}

function positionCamera() {
  var center = getCenterPoint(mesh);
  var distanceFactor = getDistanceFactor(mesh);
  controls.target.copy( center );
  camera.lookAt( center );
  if(debug == true) {
    cube.position.set(center.x, center.y, center.z);
  }
  camera.position.multiplyScalar(distanceFactor);
}


function animate() {
  requestAnimationFrame( animate );
  controls.update(); 
  render();
}

function render() {
  renderer.render( scene, camera );
}

// Notes:
// - STL file format: http://en.wikipedia.org/wiki/STL_(file_format)
// - 80 byte unused header
// - All binary STLs are assumed to be little endian, as per wiki doc
var parseStlBinary = function(stl) {
  var geo = new THREE.Geometry();
  var dv = new DataView(stl, 80); // 80 == unused header
  var isLittleEndian = true;
  var triangles = dv.getUint32(0, isLittleEndian); 

  // console.log('arraybuffer length:  ' + stl.byteLength);
  // console.log('number of triangles: ' + triangles);

  var offset = 4;
  for (var i = 0; i < triangles; i++) {
    // Get the normal for this triangle
    var normal = new THREE.Vector3(
      dv.getFloat32(offset, isLittleEndian),
      dv.getFloat32(offset+4, isLittleEndian),
      dv.getFloat32(offset+8, isLittleEndian)
    );
    offset += 12;

    // Get all 3 vertices for this triangle
    for (var j = 0; j < 3; j++) {
      geo.vertices.push(
        new THREE.Vector3(
          dv.getFloat32(offset, isLittleEndian),
          dv.getFloat32(offset+4, isLittleEndian),
          dv.getFloat32(offset+8, isLittleEndian)
        )
      );
      offset += 12
    }

    // there's also a Uint16 "attribute byte count" that we
    // don't need, it should always be zero.
    offset += 2;   

    // Create a new face for from the vertices and the normal             
    geo.faces.push(new THREE.Face3(i*3, i*3+1, i*3+2, normal));
  }

  // The binary STL I'm testing with seems to have all
  // zeroes for the normals, unlike its ASCII counterpart.
  // We can use three.js to compute the normals for us, though,
  // once we've assembled our geometry. This is a relatively 
  // expensive operation, but only needs to be done once.
  geo.computeFaceNormals();

  mesh = new THREE.Mesh( 
    geo,
    // new THREE.MeshNormalMaterial({
    //     overdraw:true
    // }
    new THREE.MeshLambertMaterial( materialOptions )
  );
  mesh.rotateX( - Math.PI / 2 );
  scene.add(mesh);
  positionCamera();
  stl = null;
};  

var parseStl = function(stl) {
  var state = '';
  var lines = stl.split('\n');
  var geo = new THREE.Geometry();
  var name, parts, line, normal, done, vertices = [];
  var vCount = 0;
  stl = null;

  for (var len = lines.length, i = 0; i < len; i++) {
    if (done) {
      break;
    }
    line = trim(lines[i]);
    parts = line.split(' ');
    switch (state) {
      case '':
        if (parts[0] !== 'solid') {
          console.error(line);
          console.error('Invalid state "' + parts[0] + '", should be "solid"');
          return;
        } else {
          name = parts[1];
          state = 'solid';
        }
        break;
      case 'solid':
        if (parts[0] !== 'facet' || parts[1] !== 'normal') {
          console.error(line);
          console.error('Invalid state "' + parts[0] + '", should be "facet normal"');
          return;
        } else {
          normal = [
            parseFloat(parts[2]), 
            parseFloat(parts[3]), 
            parseFloat(parts[4])
          ];
          state = 'facet normal';
        }
        break;
      case 'facet normal':
        if (parts[0] !== 'outer' || parts[1] !== 'loop') {
          console.error(line);
          console.error('Invalid state "' + parts[0] + '", should be "outer loop"');
          return;
        } else {
          state = 'vertex';
        }
        break;
      case 'vertex': 
        if (parts[0] === 'vertex') {
          geo.vertices.push(new THREE.Vector3(
            parseFloat(parts[1]),
            parseFloat(parts[2]),
            parseFloat(parts[3])
          ));
        } else if (parts[0] === 'endloop') {
          geo.faces.push( new THREE.Face3( vCount*3, vCount*3+1, vCount*3+2, new THREE.Vector3(normal[0], normal[1], normal[2]) ) );
          vCount++;
          state = 'endloop';
        } else {
          console.error(line);
          console.error('Invalid state "' + parts[0] + '", should be "vertex" or "endloop"');
          return;
        }
        break;
      case 'endloop':
        if (parts[0] !== 'endfacet') {
          console.error(line);
          console.error('Invalid state "' + parts[0] + '", should be "endfacet"');
          return;
        } else {
          state = 'endfacet';
        }
        break;
      case 'endfacet':
        if (parts[0] === 'endsolid') {
          //mesh = new THREE.Mesh( geo, new THREE.MeshNormalMaterial({overdraw:true}));
          mesh = new THREE.Mesh( 
            geo, 
            new THREE.MeshLambertMaterial( materialOptions )
          );
          mesh.rotateX( - Math.PI / 2 );
          scene.add(mesh);
          positionCamera();
          done = true;
        } else if (parts[0] === 'facet' && parts[1] === 'normal') {
          normal = [
            parseFloat(parts[2]), 
            parseFloat(parts[3]), 
            parseFloat(parts[4])
          ];
          if (vCount % 1000 === 0) {
            //console.log(normal);
          }
          state = 'facet normal';
        } else {
          console.error(line);
          console.error('Invalid state "' + parts[0] + '", should be "endsolid" or "facet normal"');
          return;
        }
        break;
      default:
        console.error('Invalid state "' + state + '"');
        break;
    }
  }
};

function trim (str) {
  str = str.replace(/^\s+/, '');
  for (var i = str.length - 1; i >= 0; i--) {
    if (/\S/.test(str.charAt(i))) {
      str = str.substring(0, i + 1);
      break;
    }
  }
  return str;
}

function onWindowResize() {
  windowHalfX = window.innerWidth / 2;
  windowHalfY = window.innerHeight / 2;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize( window.innerWidth, window.innerHeight );
}

function onDocumentMouseDown( event ) {
  event.preventDefault();
  document.addEventListener( 'mousemove', onDocumentMouseMove, false );
  document.addEventListener( 'mouseup', onDocumentMouseUp, false );
  document.addEventListener( 'mouseout', onDocumentMouseOut, false );
  mouseXOnMouseDown = event.clientX - windowHalfX;
  targetRotationOnMouseDown = targetRotation;
}
function onDocumentMouseMove( event ) {
  mouseX = event.clientX - windowHalfX;
  targetRotation = targetRotationOnMouseDown + ( mouseX - mouseXOnMouseDown ) * 0.02;
}
function onDocumentMouseUp( event ) {
  document.removeEventListener( 'mousemove', onDocumentMouseMove, false );
  document.removeEventListener( 'mouseup', onDocumentMouseUp, false );
  document.removeEventListener( 'mouseout', onDocumentMouseOut, false );
}
function onDocumentMouseOut( event ) {
  document.removeEventListener( 'mousemove', onDocumentMouseMove, false );
  document.removeEventListener( 'mouseup', onDocumentMouseUp, false );
  document.removeEventListener( 'mouseout', onDocumentMouseOut, false );
}
function onDocumentTouchStart( event ) {
  if ( event.touches.length === 1 ) {
    event.preventDefault();
    mouseXOnMouseDown = event.touches[ 0 ].pageX - windowHalfX;
    targetRotationOnMouseDown = targetRotation;
  }
}
function onDocumentTouchMove( event ) {
  if ( event.touches.length === 1 ) {
    event.preventDefault();
    mouseX = event.touches[ 0 ].pageX - windowHalfX;
    targetRotation = targetRotationOnMouseDown + ( mouseX - mouseXOnMouseDown ) * 0.05;
  }
}

// This is how our plugin registers itself with the application, by adding some configuration information to
  // the global variable ADDITIONAL_VIEWMODELS
  ADDITIONAL_VIEWMODELS.push([
      // This is the constructor to call for instantiating the plugin
      ViewSTLViewModel,

      // This is a list of dependencies to inject into the plugin, the order which you request here is the order
      // in which the dependencies will be injected into your view model upon instantiation via the parameters
      // argument
      ["gcodeFilesViewModel"],

      // Finally, this is the list of all elements we want this view model to be bound to.
      [("#tab_plugin_viewstl")]
]);