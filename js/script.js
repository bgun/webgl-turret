// Paul Irish's requestAnimationFrame shim
// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
window.requestAnimFrame = (function() {
  return window.requestAnimationFrame || 
    window.webkitRequestAnimationFrame || 
    window.mozRequestAnimationFrame    || 
    window.oRequestAnimationFrame      || 
    window.msRequestAnimationFrame     || 
    function( callback ){
      window.setTimeout(callback, 1000 / 60);
    };
})();

var game = {
  entities: {
    badguys: [],
    bullets: [],
    sparks:  [],
    powerups:[],
    camera:  {},
    scene:   {},
    turret:  {}
  },
  materials: {
    metalMaterial: new THREE.MeshLambertMaterial({
      color: 0xDDDDDD,
      reflectivity: 0.25
    }),
    metalWireMaterial: new THREE.MeshLambertMaterial({
      color: 0x666666,
      wireframe: true,
      wireframeLinewidth: 4
    }),
    metalFlatMaterial: new THREE.MeshLambertMaterial({
      color: 0xDDDDDD,
      shading: THREE.FlatShading
    }),
    groundMaterial: new THREE.MeshLambertMaterial({
      color: 0xAA5500
    }),
    badguyMaterial: new THREE.MeshLambertMaterial({
      color: 0x555555,
      shininess: 90
    }),
    badguyHurtMaterial: new THREE.MeshLambertMaterial({
      color: 0x994444
    }),
    bulletMaterial: new THREE.MeshBasicMaterial({
      //blending: THREE.AdditiveBlending,
      color: 0xFFBB77,
      transparent: true
    }),
    sparkMaterial: new THREE.ParticleBasicMaterial({
      //blending: THREE.AdditiveBlending,
      color: 0xFF5500,
      map: THREE.ImageUtils.loadTexture('images/spark.png'),
      size: 100,
      transparent: true
    }),
    blueSparkMaterial: new THREE.ParticleBasicMaterial({
      //blending: THREE.AdditiveBlending,
      color: 0x0066FF,
      map: THREE.ImageUtils.loadTexture('images/spark.png'),
      size: 100,
      transparent: true
    }),
    powerupMaterial: new THREE.MeshLambertMaterial({
      color: 0x444444,
      emissive: 0x4488BB,
      wireframe: true,
      wireframeLinewidth: 4
    }),
    spotMaterial: new THREE.MeshBasicMaterial({
      color: 0xFFFFFF
    })
  },
  renderer: {},
  /*
  soundfx: {
    laserIndex: 0
  },
  */
  waves: [
    {
      enemyCount: 30,
      enemyChance: 150
    },
    {
      enemyCount: 50,
      enemyChance: 120
    },
    {
      enemyCount: 80,
      enemyChance: 100
    }
  ],
  // settings
  BULLET_SPEED: 15,
  ENEMY_MAX_LIFE: 3,
  ENEMY_MIN_DELAY: 20, // minimum delay between creating new enemies
  ENEMY_START_DISTANCE: 1000,
  ENEMY_SPEED: 1.2,
  POWERUP_CHANCE: 600, // 1/x chance of
  POWERUP_TYPES: ['shotgun','laser','missile'],
  RELOAD_DELAY: 200,
  TURRET_ACCEL: 0.002,
  TURRET_FRICTION: 0.001,
  TURRET_MAX_LIFE: 5,
  TURRET_MAX_SPEED: 0.05,
  // state
  currentKills: 0,
  currentLife: 0,
  currentWave: -1, // index in waves array, add 1 when showing to user
  enemiesMadeForWave: 0,
  enemyDelay: 0,
  playing: false,
  reloading: false,
  shotsFired: 0,
  shotsHit: 0,
  totalKills: 0,
  turretRotationSpeed: 0
};

//var $container, $panel, $message;
var inputController = {};

game.init = function() {

  // get the DOM element to attach to
  // - assume we've got jQuery to hand
  //$container = $('#container');
  //$message   = $('#message');
  //$panel     = $('#panel');
  //$message.on('click',game.start);

  var container = document.createElement("div");
  container.id = "container";
  document.body.appendChild(container);

  //game.showMessage("Click to start", "Mouse to rotate, spacebar/click to fire");

  // sound effects
  //game.soundfx.$laser = $('.sfx-laser');

  // set the scene size
  game.WIDTH  = window.innerWidth;
  game.HEIGHT = window.innerHeight;

  // set some camera attributes
  game.VIEW_ANGLE = 45;
  game.ASPECT = game.WIDTH / game.HEIGHT;
  game.NEAR = 0.1;
  game.FAR = 10000;

  // create a WebGL renderer, camera
  // and a scene
  game.renderer = new THREE.WebGLRenderer({antialias:true});
  game.renderer.setSize(game.WIDTH, game.HEIGHT);
  game.renderer.shadowMapEnabled = true;
  // attach the render-supplied DOM element
  //$container.append(game.renderer.domElement);
  container.appendChild(game.renderer.domElement);

  // create the scene
  game.scene = new THREE.Scene();

  // define camera
  game.camera = new THREE.PerspectiveCamera(
    game.VIEW_ANGLE,
    game.ASPECT,
    game.NEAR,
    game.FAR);
  game.camera.position.z = 600;
  game.camera.position.y = 1000;
  game.camera.lookAt(new THREE.Vector3(0,0,0));

  // geometries
  var ground = new THREE.Mesh(
    new THREE.PlaneGeometry(4000,4000,100,100),
    game.materials.groundMaterial);
    ground.rotation.x = -(90*(Math.PI/180));
    ground.position.y = 0;
    ground.receiveShadow = true;
  game.entities.turret = game.makeTurret(0,0,0);

  // light the scene
  var keyLight = new THREE.SpotLight(0xffffff, 0.8);
      keyLight.position.x = 500;
      keyLight.position.y = 500;
      keyLight.position.z = 500;
      //keyLight.castShadow = true;
  var sunLight = new THREE.DirectionalLight(0xff6666, 0.5);
      sunLight.position.set(0,1,0);

  game.sparkLight   = new THREE.PointLight(0xFF8800, 0.1, 500);
  game.powerupLight = new THREE.PointLight(0x0066FF, 1, 300);

  // populate the scene
  game.scene.add(game.camera);
  game.scene.add(game.entities.turret);
  game.scene.add(ground);
  game.scene.add(keyLight);
  game.scene.add(sunLight);
  game.scene.add(game.sparkLight);
  game.scene.add(game.powerupLight);

  // key controls
  $(document).on('click',function(e) {
    var cartX =  e.clientX - (game.WIDTH / 2),
        cartY =  e.clientY - (game.HEIGHT / 2),
        theta = Math.atan(cartX/cartY);
    if(cartY < 0) {
      theta = theta+(Math.PI);
    }
    game.entities.turret.rotation.y = theta;
    //inputController.fire = true;
    game.fireTurret();
  });

  // start animation
  console.log("Initialized");
  game.animloop();
  game.start();
}

game.getRandomPointInRing = function(ringInner, ringWidth) {
  // Generate a random point within a ring with inner radius (ringInner) and outer radius (ringInner+ringWidth)
  var randAngle = Math.floor(Math.random()*360) * Math.PI/180;
  var x = Math.sin(randAngle) * (ringInner+Math.floor(Math.random()*ringWidth));
  var z = Math.cos(randAngle) * (ringInner+Math.floor(Math.random()*ringWidth));
  var y = 0;
  return new THREE.Vector3(x,y,z);
}

game.getAngleTowardPoint = function(pos1, pos2) {
  // Get the angle to orient pos1 toward pos2. If pos2 is not provided assume center.
  if(!pos2) {
    var pos2 = new THREE.Vector3(0,0,0);
  }
  var theta = Math.atan((pos1.x-pos2.x) / (pos1.z-pos2.z));
  return theta;
}

game.makeTurret = function(x,y,z) {
  var t = new THREE.Object3D();
      t.position.x = x;
      t.position.y = y;
      t.position.z = z;

  var base = new THREE.Mesh(
    new THREE.CylinderGeometry(65,65,6,8,1,false),
    game.materials.metalMaterial);
      base.castShadow = true;
      base.receiveShadow = true;
      base.position.y = 3;

  var base2 = new THREE.Mesh(
    new THREE.CylinderGeometry(64,70,16,8,1,false),
    game.materials.metalWireMaterial);
      base2.castShadow = true;
      base2.receiveShadow = true;
      base2.position.y = 8;
      base2.rotation.y = 22.5;

  var dome = new THREE.Mesh(
    new THREE.SphereGeometry(50,8,8,0,Math.PI*2,0,Math.PI/2),
    game.materials.metalMaterial);
      dome.castShadow = true;
      dome.receiveShadow = true;
      dome.position.y = 15;

  var lathePts = [];
  lathePts.push(new THREE.Vector3(12, 0, 0));
  lathePts.push(new THREE.Vector3(11, 0, 50));
  lathePts.push(new THREE.Vector3(13, 0, 51));
  lathePts.push(new THREE.Vector3(12, 0, 70));
  lathePts.push(new THREE.Vector3(10, 0, 71));
  lathePts.push(new THREE.Vector3(9,  0, 90));
  lathePts.push(new THREE.Vector3(6,  0, 90));
  lathePts.push(new THREE.Vector3(6,  0, 00));
  var gun  = new THREE.Mesh(
    new THREE.LatheGeometry(lathePts,4),
    game.materials.metalFlatMaterial);
      gun.position.set(0,38,(-90*Math.PI/180));
      gun.castShadow = true;
      gun.receiveShadow = true;
      gun.scale.set(1.2,1.2,1.2);

  var lightTarget = new THREE.Object3D();
      lightTarget.position.set(30,70,200);
  var light = new THREE.SpotLight(0xFFDD66, 4);
      light.position.set(30,70,50);
      light.target = lightTarget;
      light.castShadow = true;

  t.add(base);
  t.add(base2);
  t.add(dome);
  t.add(gun);
  t.add(light);
  t.add(lightTarget);
  return t;
}

game.makePowerup = function(pos) {
  if(!pos) {
    var pos = game.getRandomPointInRing(400,300);
  }
  var p = new THREE.Mesh(
    new THREE.BoxGeometry(50,30,50),
    game.materials.powerupMaterial);
  console.log("powerup",p);
  p.position = pos;
  p.data = {
    vertSpeed   : 3,
    powerupType : Math.floor(Math.random()*game.POWERUP_TYPES.length)
  };

  game.powerupLight.position = pos;
  game.powerupLight.position.y = 120;
  game.powerupLight.intensity = 3;

  game.entities.powerups.push(p);
  game.scene.add(p);
}

game.makeSparks = function(options) {
  var defaults = {
    count: 50,
    life: 20,
    material: game.materials.sparkMaterial,
    pos: new THREE.Vector3(0,50,0),
    radius: 50
  }
  var settings = $.extend({}, defaults, options);
  var particles = new THREE.Geometry();
  var particle;
  for(var p = 0; p < settings.count; p++) {
    particle = new THREE.Vector3(
      (Math.random() * settings.radius) - (settings.radius/2),
      (Math.random() * settings.radius) - (settings.radius/2),
      (Math.random() * settings.radius) - (settings.radius/2)
    );
    particles.vertices.push(particle);
  }
  var sparks = new THREE.ParticleSystem(
    particles,
    settings.material);
  sparks.sortParticles = true;
  sparks.position = settings.pos;
  sparks.life = settings.life;
  return sparks;
}

game.makeBadGuy = function() {
  // stop making badguys if wave is done
  if(game.enemiesMadeForWave >= game.waves[game.currentWave].enemyCount) {
    return;
  } else {
    game.enemiesMadeForWave++;
  }
  var badguy = new THREE.Object3D();
  var shell = new THREE.Mesh(
    new THREE.SphereGeometry(40,16,4,0,Math.PI*2,0,Math.PI/2),
    game.materials.badguyMaterial);
      shell.position.y = 0;
      shell.castShadow = true;
      shell.receiveShadow = true;
  var mohawk = new THREE.Mesh(
    new THREE.CylinderGeometry(48,45,16,16),
    game.materials.badguyMaterial);
      mohawk.rotation.x = 90*(Math.PI/180);
      mohawk.rotation.z = 90*(Math.PI/180);
      mohawk.castShadow = true;
      mohawk.receiveShadow = true;

  badguy.add(shell);
  badguy.add(mohawk);

  badguy.position = game.getRandomPointInRing(game.ENEMY_START_DISTANCE, 100);
  badguy.rotation.y = game.getAngleTowardPoint(badguy.position, game.entities.turret.position);

  var hyp = Math.sqrt(Math.pow(badguy.position.x,2) + Math.pow(badguy.position.z,2));
  console.log("badguy",badguy);
  badguy.data = {
    speedX : -badguy.position.x * (game.ENEMY_SPEED / hyp),
    speedZ : -badguy.position.z * (game.ENEMY_SPEED / hyp),
    life   : game.ENEMY_MAX_LIFE
  };

  game.scene.add(badguy);
  game.entities.badguys.push(badguy);
}

game.makeBullet = function() {
  var tr;
  var bullet = new THREE.Mesh(
    new THREE.SphereGeometry(10,5,5),
    game.materials.bulletMaterial);
      tr = game.entities.turret.rotation.y;
      bullet.position.x = Math.sin(tr) * 80;
      bullet.position.y = 38;
      bullet.position.z = Math.cos(tr) * 80;
      bullet.xSpeed = Math.sin(tr) * game.BULLET_SPEED;
      bullet.zSpeed = Math.cos(tr) * game.BULLET_SPEED;
  game.entities.bullets.push(bullet);
  game.scene.add(bullet);
}

game.fireTurret = function() {
  game.shotsFired++;
  game.makeBullet();
  
  /*
  if(game.soundfx.laserIndex > game.soundfx.$laser.length-1) {
    game.soundfx.laserIndex = 0;
  }
  game.soundfx.$laser[game.soundfx.laserIndex].play();
  game.soundfx.laserIndex++;
  */

  game.reloading = true;
  setTimeout(function() {
    game.reloading = false;
  },game.RELOAD_DELAY);
}

game.hitTest = function(object1, object2, range) {
  // stupid simple x-z hit test for now
  if(!range) {
    range = 40;
  }
  if((Math.abs(object1.position.x - object2.position.x) < range) &&
     (Math.abs(object1.position.z - object2.position.z) < range)) {
    return true;
  } else {
    return false;
  }
}

/*
game.updatePanel = function() {
  // display stats
  $panel.find('#life').css({
    height: ((game.currentLife / game.TURRET_MAX_LIFE) * 100)+'%'
  });
}

game.showMessage = function(title, msg, fadeTime) {
  $message.find('h2').html(title);
  if(msg) {
    $message.removeClass('no-msg').find('p').html(msg);
  } else {
    $message.addClass('no-msg').find('p').html('');
  }
  $message.fadeIn();
  if(fadeTime) {
    setTimeout(function() {
      $message.fadeOut();
    },fadeTime);
  }
}
*/

game.nextWave = function() {
  game.currentWave++;
  game.currentKills = 0;
  game.enemiesMadeForWave = 0;
  game.clearAll();
  //game.showMessage('Wave '+(game.currentWave+1), '', 2000);
}

game.clearAll = function() {
  // except our hero, of course
  for(var bl in game.entities.bullets) {
    game.scene.remove(game.entities.bullets[bl]);
  }
  for(var bg in game.entities.badguys) {
    game.scene.remove(game.entities.badguys[bg]);
  }
  game.entities.bullets = [];
  game.entities.badguys = [];
}

game.moveAll = function() {

  // handle input
  if(inputController.left  && game.turretRotationSpeed < game.TURRET_MAX_SPEED) {
    game.turretRotationSpeed += game.TURRET_ACCEL;
  }
  if(inputController.right && game.turretRotationSpeed > -game.TURRET_MAX_SPEED) {
    game.turretRotationSpeed -= game.TURRET_ACCEL;
  }
  /*
  if(inputController.fire && !game.reloading) {
    game.fireTurret();
  }
  */

  // turret friction
  if(game.turretRotationSpeed > 0) {
    game.turretRotationSpeed -= game.TURRET_FRICTION;
  } else {
    game.turretRotationSpeed += game.TURRET_FRICTION;
  }
  game.entities.turret.rotation.y += game.turretRotationSpeed;

  // bullets
  if(game.entities.bullets.length > 0) {
    // if we have too many bullets, clean up the oldest one
    if(game.entities.bullets.length > 100) {
      game.scene.remove(game.entities.bullets[0]);
      game.entities.bullets.splice(0,1);
    }
    // update bullets
    for(var i in game.entities.bullets) {
      var b = game.entities.bullets[i];
      b.position.set(b.position.x+b.xSpeed, 38, b.position.z+b.zSpeed);
    }
  }

  // generate bad guys
  if(Math.floor(Math.random() * game.waves[game.currentWave].enemyChance) === 1) {
    // enforce minimum delay for enemy creation or they will occasionally overlap and it's ugly
    if(game.enemyDelay <= 0) {
      game.makeBadGuy();
      game.enemyDelay = game.ENEMY_MIN_DELAY;
    }
  }
  game.enemyDelay--;

  // generate powerups
  if(Math.floor(Math.random() * game.POWERUP_CHANCE) === 1) {
    game.makePowerup();
  }

  // move spark systems
  for(var s in game.entities.sparks) {
    var sp = game.entities.sparks[s];
    sp.scale.multiplyScalar(1.1);
    for(var p in sp.geometry.vertices) {
      sp.geometry.vertices[p].y += (sp.life-15)/5;
    }
    sp.geometry.verticesNeedUpdate = true;
    sp.life -= 1;
    if(sp.life === 0) {
      game.scene.remove(sp);
      game.entities.sparks.splice(s,1);
    }
  }

  // move powerups and do hit tests
  for(var p in game.entities.powerups) {
    var pw = game.entities.powerups[p];
    if(pw.position.y > 30) {
      pw.position.y += pw.data.vertSpeed;
      pw.data.vertSpeed -= 0.2;
    }
    pw.rotation.y += 0.02;
    for(var j in game.entities.bullets) {
      if(game.hitTest(game.entities.bullets[j], pw)) {
        game.scene.remove(game.entities.bullets[j]);
        game.entities.bullets.splice(j,1);
        game.scene.remove(pw);
        game.entities.powerups.splice(p,1);
      }
    }
  }

  // move bad guys and do hit tests
  for(var i in game.entities.badguys) {
    var b = game.entities.badguys[i];
    b.position.x += b.data.speedX;
    b.position.z += b.data.speedZ;

    // test for badguys hitting turret
    if(game.hitTest(b, game.entities.turret, 90)) {
      game.scene.remove(b);
      game.currentLife--;
      game.currentKills++;
      if(game.currentLife == 0) {
        game.end();
      }
      game.entities.badguys.splice(i,1);
      var s = game.makeSparks({ material: game.materials.blueSparkMaterial });
      game.entities.sparks.push(s);
      game.scene.add(s);
    }
    // test for bullets hitting badguys
    for(var j in game.entities.bullets) {
      if(game.hitTest(b, game.entities.bullets[j], 30)) {
        // bad guy hurt or dies
        b.data.life -= 1;
        if(b.data.life === 0) {
          game.scene.remove(b);
          game.entities.badguys.splice(i,1);
          var s = game.makeSparks({ pos: game.entities.bullets[j].position });
          game.entities.sparks.push(s);
          game.scene.add(s);
          game.currentKills++;
          game.totalKills++;
          game.sparkLight.position = game.entities.bullets[j].position
          game.sparkLight.intensity = 5;
        } else if(b.data.life / game.ENEMY_MAX_LIFE < .5) {
          b.children[0].material = game.materials.badguyHurtMaterial;
          b.children[1].material = game.materials.badguyHurtMaterial;
        }
        // bullet dies
        game.shotsHit++;
        game.scene.remove(game.entities.bullets[j]);
        game.entities.bullets.splice(j,1);
        // update kill count
        continue;
      }
    }
  }

  if(game.sparkLight.intensity > 0) {
    game.sparkLight.intensity -= 0.2;
  }
  if(game.powerupLight.intensity > 0) {
    game.powerupLight.intensity -= 0.02;
  }

  // if all badguys are dead, increase wave
  if(game.currentKills >= game.waves[game.currentWave].enemyCount) {
    game.nextWave();
  }
}

game.start = function() {
  //$message.off('click');

  // clean up
  game.clearAll();
 
  // reset stats
  game.currentLife = game.TURRET_MAX_LIFE;
  game.kills = 0;
  game.shotsFired = 0;
  game.shotsHit = 0;
  game.currentWave = -1;
  game.playing = true;
  game.nextWave();
}

game.end = function() {
  var hitPct;
  var bigbang1 = game.makeSparks({pos: new THREE.Vector3( 20, 20, 20), material: game.materials.blueSparkMaterial});
  var bigbang2 = game.makeSparks({pos: new THREE.Vector3(-30, 20, 10), material: game.materials.blueSparkMaterial});
  var bigbang3 = game.makeSparks({pos: new THREE.Vector3( 10, 20,-30), material: game.materials.blueSparkMaterial});
  game.scene.add(bigbang1);
  game.scene.add(bigbang2);
  game.scene.add(bigbang3);
  game.entities.sparks.push(bigbang1, bigbang2, bigbang3);
  // avoid division by zero/NaN
  if(game.shotsHit > 0) {
    hitPct = Math.floor((game.shotsHit / game.shotsFired) * 100);
  } else {
    hitPct = 0;
  }
  //game.showMessage("Game over","Accuracy: "+hitPct+"% &nbsp; Kills: "+game.kills);
  //$message.on('click',game.start);
  setTimeout(function() {
    game.playing = false;
  },150);
}

game.animloop = function() {
  requestAnimFrame(game.animloop);
  if(game.playing) {
    game.moveAll();
  }
  //game.updatePanel();
  game.renderer.render(game.scene, game.camera);
}

//$(function() {
window.addEventListener("load",function() {
  game.init();
});
