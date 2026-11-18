var SPEED = 0.004;
var CAMERA_LAG = 0.9;
var COLLISION = 1.1;
var BOUNCE = 0.7;
var mapscale = 5;
var BOUNCE_CORRECT = 0.01;
var WALL_SIZE = 1.2;
var MOUNTAIN_DIST = 250;
var OOB_DIST = 200;
var LAPS = 3;
var BASE_FOV = 90;
var DASH_FOV = 110;
var DASH_BOOST = 2;
var DASH_DRAIN = 0.012;
var DASH_REGEN = 0.004;
function MODS(){

}

setTimeout(function(){
	document.getElementById("title").style.transform = "none";
}, 500);
setTimeout(function(){
	document.getElementsByClassName("menuitem")[0].style.transform = "none";
}, 1000);
setTimeout(function(){
	document.getElementsByClassName("menuitem")[1].style.transform = "none";
}, 1200);
setTimeout(function(){
	document.getElementsByClassName("menuitem")[2].style.transform = "none";
}, 1400);
setTimeout(function(){
	document.getElementById("mywebsitelink").style.transform = "none";
}, 1600);
setTimeout(function(){
	document.getElementById("settings").style.transform = "none";
}, 1800);

if(top != self) {
	document.getElementById("warning").style.display = "block";
}

function forceScroll(){
	requestAnimationFrame(forceScroll);
	window.scrollTo(0, 0);
}
forceScroll();

var camera, renderer, scene, renderer2, scene2, labels = [];
scene = new THREE.Scene();
renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
var mobile = navigator.userAgent.match("Mobile")!=null||navigator.userAgent.match("Linux;")!=null;
if(!mobile){
	renderer.shadowMap.enabled = false;
	renderer.shadowMap.autoUpdate = false;
	renderer.shadowMap.needsUpdate = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}
var element = renderer.domElement;

function toggleFullScreen() {
	var doc = window.document;
	var docEl = doc.documentElement;

	var requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
	var cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

	if(!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
		requestFullScreen.call(docEl);
	}
	else {
		cancelFullScreen.call(doc);
	}
	window.scrollTo(0,1);
}

var name, code, players = {}, me = {}, gameStarted = false, gameSortaStarted = false, left = false, right = false, lap;
var gameMode = "race", gameOver = false, speedMul = 1, tagTime = 120, tagEndsAt = 0, runnersAtStart = 0, roleEl, roleTimer;
var TAG_DIST = 2.3;
var CFG_LIMITS = {laps: [1, 20, 1], speed: [50, 150, 10], time: [30, 600, 15]};
var cfg = {mode: "race", laps: LAPS, speed: 100, time: 120};
var dashKey = false, dashTouch = false, dashEnergy = 1, dashLocked = false, dashFill;
var carPos = [
	{x: 0, y: 0},
	{x: 2, y: 0},
	{x: -2, y: 0},
	{x: 0, y: -3},
	{x: -2, y: -3},
	{x: 2, y: -3},
	{x: 0, y: -6},
	{x: 2, y: -6},
	{x: -2, y: -6},
	{x: 0, y: -9},
	{x: 2, y: -9},
	{x: -2, y: -9},
	{x: 0, y: -12},
	{x: -2, y: -12},
	{x: 2, y: -12},
	{x: 0, y: -15},
	{x: 2, y: -15},
	{x: -2, y: -15}
];
var sat = 100, light = 50;
var NAME_ADJ = ["Turbo", "Speedy", "Rapid", "Nitro", "Drift", "Blazing", "Flying", "Mighty", "Sneaky", "Lucky", "Cosmic", "Electric", "Frosty", "Golden", "Rocket", "Savage", "Wild", "Zippy"];
var NAME_NOUN = ["Panda", "Falcon", "Tiger", "Comet", "Racer", "Viper", "Wolf", "Dragon", "Cheetah", "Bandit", "Shark", "Phoenix", "Rhino", "Otter", "Meteor", "Gecko", "Badger", "Hornet"];

function clampNum(v, lo, hi, def){
	v = Number(v);
	return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def;
}

var color = Math.floor(Math.random() * 360);
var f = document.getElementById("fore");
var huePicker = document.getElementById("colorpicker");
var hueSlider = document.getElementById("slider");
var satSlider = document.getElementById("satslider");
var lightSlider = document.getElementById("lightslider");
var satPicker = document.getElementById("satpicker");
var lightPicker = document.getElementById("lightpicker");
var nameBox = document.getElementById("name");

function saveProfile(){
	try{
		localStorage.setItem("carsProfile", JSON.stringify({name: nameBox.value, color: color, sat: sat, light: light}));
	}catch(e){}
}

function loadProfile(){
	try{
		var p = JSON.parse(localStorage.getItem("carsProfile"));
		if(!p)
			return;
		if(typeof p.name == "string")
			nameBox.value = p.name.substring(0, 50);
		color = Math.floor(clampNum(p.color, 0, 360, color));
		sat = Math.round(clampNum(p.sat, 0, 100, 100));
		light = Math.round(clampNum(p.light, 0, 100, 50));
	}catch(e){}
}

function randomName(){
	nameBox.value = NAME_ADJ[Math.floor(Math.random() * NAME_ADJ.length)] + " " + NAME_NOUN[Math.floor(Math.random() * NAME_NOUN.length)];
	saveProfile();
}

function bindPicker(el, set){
	function move(e){
		var x = e.clientX - el.getBoundingClientRect().left;
		x = Math.min(el.clientWidth, Math.max(0, x));
		set(x / el.clientWidth);
		updateColor();
	}
	el.addEventListener("mousedown", move);
	el.addEventListener("mousemove", function(e){
		if(e.buttons == 1)
			move(e);
	});
	el.addEventListener("touchstart", function(e){
		move(e.touches[0]);
	});
	el.addEventListener("touchmove", function(e){
		move(e.touches[0]);
	});
}

function updateColor(){
	var car = "hsl(" + color + ", " + sat + "%, " + light + "%)";
	hueSlider.style.marginLeft = color / 360 * 100 + "%";
	hueSlider.style.backgroundColor = car;
	satSlider.style.marginLeft = sat / 100 * 100 + "%";
	satSlider.style.backgroundColor = car;
	lightSlider.style.marginLeft = light / 100 * 100 + "%";
	lightSlider.style.backgroundColor = car;
	satPicker.style.background = "linear-gradient(90deg, hsl(" + color + ", 0%, " + light + "%), hsl(" + color + ", 100%, " + light + "%))";
	lightPicker.style.background = "linear-gradient(90deg, hsl(" + color + ", " + sat + "%, 0%), hsl(" + color + ", " + sat + "%, 50%), hsl(" + color + ", " + sat + "%, 100%))";
	document.body.style.backgroundColor = "hsl(" + color + ", 50%, 50%)";
	saveProfile();
}
bindPicker(huePicker, function(v){
	color = Math.floor(v * 360);
});
bindPicker(satPicker, function(v){
	sat = Math.round(v * 100);
});
bindPicker(lightPicker, function(v){
	light = Math.round(v * 100);
});
nameBox.addEventListener("input", saveProfile);
loadProfile();
updateColor();

function menu2(){
	if(mobile){
		function reactOrientation(e){
			var angle = screen.orientation.type == "portrait-primary" ? e.gamma : screen.orientation.type == "portrait-secondary" ? -e.gamma : screen.orientation.type == "landscape-primary" ? e.beta : screen.orientation.type == "landscape-secondary" ? -e.beta : 0;
			me.data.steer = Math.max(Math.min((-angle) / 180 * Math.PI, Math.PI / 6), -Math.PI / 6);
		}

		if(DeviceOrientationEvent.requestPermission){
			DeviceOrientationEvent.requestPermission("The game needs to access phone tilt so you can steer your car.").then(permissionState => {
				if (permissionState === 'granted')
					window.addEventListener('deviceorientation', reactOrientation);
				else
					alert("Permission denied");
			}).catch(alert);
    		}else{
			window.addEventListener('deviceorientation', reactOrientation);
		}
	}
	if(document.getElementById("name").value == "")
		name = "Nerd with No Name";
	else
		name = document.getElementById("name").value;
	f.style.transform = "translate3d(0, -100vh, 0)";
	setTimeout(function(){
		f.innerHTML = "<div class='menuitem title button' id='host' ontouchstart='this.click()' onclick='host()'>Host a game</div><div class='menuitem title button' ontouchstart='this.click()' id='join' onclick='joinGame()'>Join a game</div>";
		f.style.transform = "none";
		setTimeout(function(){
			document.getElementById("host").style.transform = "none";
			setTimeout(function(){
				document.getElementById("host").style.transition = "transform .2s, box-shadow .2s";
			}, 500);
		}, 500);
		setTimeout(function(){
			document.getElementById("join").style.transform = "none";
			setTimeout(function(){
				document.getElementById("join").style.transition = "transform .2s, box-shadow .2s";
			}, 500);
		}, 1000);
	}, 500);
}

var PEER_PREFIX = "cars-game-";
var CODE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
var net = {peer: null, conns: {}, hostConn: null, isHost: false, status: 0};

function broadcast(msg, except){
	for(var id in net.conns){
		if(id !== except && net.conns[id].open)
			net.conns[id].send(msg);
	}
}

function snapshot(){
	var out = {};
	for(var id in players)
		out[id] = players[id].data;
	return out;
}

function sendMe(){
	if(net.isHost)
		broadcast({t: "u", id: me.id, d: me.data});
	else if(net.hostConn && net.hostConn.open)
		net.hostConn.send({t: "u", d: me.data});
}

function newPlayerData(){
	return {
		x: 0,
		y: 0,
		xv: 0,
		yv: 0,
		dir: 0,
		steer: 0,
		dash: 0,
		color: color,
		sat: sat,
		light: light,
		name: name,
		checkpoint: 1,
		lap: 0,
		collision: {}
	};
}

function addPlayer(id, data, mine){
	if(players[id])
		return;
	var pl = players[id] = {
		data: data,
		it: false,
		model: new THREE.Mesh(new THREE.BoxBufferGeometry(1, 1, 2))
	};
	pl.model.position.set(pl.data.x, 0.6, pl.data.y);
	pl.model.material = new THREE.MeshLambertMaterial({color: new THREE.Color("hsl(" + clampNum(pl.data.color, 0, 360, 0) + ", " + clampNum(pl.data.sat, 0, 100, 100) + "%, " + clampNum(pl.data.light, 0, 100, 50) + "%)")});
	var wheel = new THREE.Mesh(
		new THREE.CylinderBufferGeometry(0.5, 0.5, 0.2, 10),
		new THREE.MeshLambertMaterial({color: new THREE.Color("#222")})
	);
	var wheelSpots = [[0.6, 0.7], [-0.6, 0.7], [0.6, -0.7], [-0.6, -0.7]];
	for(var i = 0; i < wheelSpots.length; i++){
		var w = wheel.clone();
		w.position.set(wheelSpots[i][0], -0.1, wheelSpots[i][1]);
		w.rotation.set(Math.PI / 2, 0, Math.PI / 2);
		pl.model.add(w);
	}
	var label = document.createElement("DIV");
	label.className = "label";
	label.innerHTML = String(pl.data.name).replaceAll("<", "&lt;").substring(0, 50) + "<br/>|";
	pl.label = label;
	label.position = pl.model.position;
	f.appendChild(label);
	labels.push(label);
	pl.model.receiveShadow = true;
	scene.add(pl.model);
	if(mine){
		me.label = pl.label;
		me.model = pl.model;
		me.label.innerHTML = "";
	}
}

function removePlayer(id){
	var pl = players[id];
	if(!pl)
		return;
	scene.remove(pl.model);
	if(pl.label.parentNode)
		pl.label.parentNode.removeChild(pl.label);
	var i = labels.indexOf(pl.label);
	if(i >= 0)
		labels.splice(i, 1);
	delete players[id];
}

function leaveGame(){
	if(net.peer)
		net.peer.destroy();
	location.reload();
}

function sanitizeCfg(c){
	c = c || {};
	return {
		mode: c.mode == "tag" ? "tag" : "race",
		laps: Math.round(clampNum(c.laps, CFG_LIMITS.laps[0], CFG_LIMITS.laps[1], 3)),
		speed: Math.round(clampNum(c.speed, CFG_LIMITS.speed[0], CFG_LIMITS.speed[1], 100)),
		time: Math.round(clampNum(c.time, CFG_LIMITS.time[0], CFG_LIMITS.time[1], 120))
	};
}

function fmtTime(sec){
	return Math.floor(sec / 60) + ":" + ("0" + sec % 60).slice(-2);
}

function cfgHtml(){
	var tag = cfg.mode == "tag";
	function row(label, ctl){
		return "<div class='cfgrow'><div class='cfglabel'>" + label + "</div><div class='cfgctl'>" + ctl + "</div></div>";
	}
	function step(key, text){
		return "<div class='cfgbtn sq' data-act='step' data-key='" + key + "' data-dir='-1'>-</div><div class='cfgval'>" + text + "</div><div class='cfgbtn sq' data-act='step' data-key='" + key + "' data-dir='1'>+</div>";
	}
	var modes = "<div class='cfgbtn" + (tag ? "" : " sel") + "' data-act='mode' data-val='race'>Racing</div><div class='cfgbtn" + (tag ? " sel" : "") + "' data-act='mode' data-val='tag'>Tag</div>";
	return "<div id='cfgbox' class='title'><div id='cfgtitle'>Settings</div>"
		+ row("Mode", modes)
		+ (tag ? row("Time", step("time", fmtTime(cfg.time))) : row("Laps", step("laps", cfg.laps)))
		+ row("Speed", step("speed", cfg.speed + "%"))
		+ "<div class='cfgbtn' id='cfgdone' data-act='done'>Done</div></div>";
}

function renderCfg(){
	var el = document.getElementById("cfg");
	if(el)
		el.innerHTML = cfgHtml();
}

function cfgClick(e){
	var t = e.target;
	var act = t.getAttribute ? t.getAttribute("data-act") : null;
	if(t.id == "cfg" || act == "done"){
		closeSettings();
		return;
	}
	if(act == "mode"){
		cfg.mode = t.getAttribute("data-val") == "tag" ? "tag" : "race";
	}else if(act == "step"){
		var key = t.getAttribute("data-key");
		var lim = CFG_LIMITS[key];
		if(!lim)
			return;
		cfg[key] = Math.min(lim[1], Math.max(lim[0], cfg[key] + Number(t.getAttribute("data-dir")) * lim[2]));
	}else
		return;
	renderCfg();
}

function openSettings(){
	if(document.getElementById("cfg"))
		return;
	var el = document.createElement("DIV");
	el.id = "cfg";
	el.addEventListener("click", cfgClick);
	f.appendChild(el);
	renderCfg();
}

function closeSettings(){
	var el = document.getElementById("cfg");
	if(el)
		el.parentNode.removeChild(el);
}

function setOutline(pl, on){
	if(on && !pl.outline){
		pl.outline = new THREE.Mesh(
			new THREE.BoxBufferGeometry(1.4, 1.4, 2.4),
			new THREE.MeshBasicMaterial({color: new THREE.Color("#fff"), side: THREE.BackSide})
		);
		pl.model.add(pl.outline);
	}else if(!on && pl.outline){
		pl.model.remove(pl.outline);
		pl.outline = null;
	}
}

function showRole(){
	if(gameMode != "tag" || !roleEl || !players[me.id])
		return;
	var it = players[me.id].it;
	roleEl.innerHTML = it ? "You are it" : "You are a runner";
	roleEl.className = (it ? "title it big" : "title big");
	clearTimeout(roleTimer);
	roleTimer = setTimeout(function(){
		roleEl.classList.remove("big");
	}, 2500);
}

function tagPlayer(id){
	var pl = players[id];
	if(!pl || pl.it)
		return;
	pl.it = true;
	setOutline(pl, true);
	if(id == me.id)
		showRole();
}

function endTag(w){
	gameOver = true;
	var c = document.getElementById("countdown");
	if(!c)
		return;
	c.style.fontSize = "18vmin";
	c.innerHTML = w == "it" ? "It wins!" : w == "runners" ? "Runners win!" : "Time!";
}

function finishTag(w){
	if(gameOver)
		return;
	endTag(w);
	broadcast({t: "end", w: w});
}

function checkTags(){
	var ids = Object.keys(players);
	var tagged = [];
	for(var i = 0; i < ids.length; i++){
		var a = players[ids[i]];
		if(!a.it)
			continue;
		for(var j = 0; j < ids.length; j++){
			var b = players[ids[j]];
			if(b.it || tagged.indexOf(ids[j]) >= 0)
				continue;
			if(a.model.position.distanceTo(b.model.position) < TAG_DIST)
				tagged.push(ids[j]);
		}
	}
	for(var k = 0; k < tagged.length; k++){
		tagPlayer(tagged[k]);
		broadcast({t: "tag", id: tagged[k]});
	}
	var runners = 0;
	for(var id in players){
		if(!players[id].it)
			runners++;
	}
	if(runnersAtStart > 0 && runners == 0)
		finishTag("it");
	else if(Date.now() >= tagEndsAt)
		finishTag(runners > 0 ? "runners" : "time");
}

function startRace(c, it){
	if(gameStarted)
		return;
	c = sanitizeCfg(c);
	gameMode = c.mode;
	LAPS = c.laps;
	speedMul = c.speed / 100;
	tagTime = c.time;
	closeSettings();
	var info = document.getElementsByClassName("info")[0];
	if(info)
		info.outerHTML = "";
	var hb = document.getElementById("hostbar");
	if(hb)
		hb.outerHTML = "";

	gameStarted = true;
	gameSortaStarted = true;

	var countDown = document.createElement("DIV");
	countDown.innerHTML = "3";
	countDown.className = "title";
	countDown.id = "countdown";
	f.appendChild(countDown);

	var bar = document.createElement("DIV");
	bar.id = "topbar";
	bar.className = "title";
	bar.innerHTML = "<div id='dashlabel'>Dash</div><div id='dashbar'><div id='dashfill'></div></div><div id='leave' ontouchstart='this.click()' onclick='leaveGame()'>Leave</div>";
	f.appendChild(bar);
	dashFill = document.getElementById("dashfill");
	var dashBar = document.getElementById("dashbar");
	function dashOn(e){
		e.preventDefault();
		dashTouch = true;
	}
	function dashOff(){
		dashTouch = false;
	}
	dashBar.addEventListener("touchstart", dashOn);
	dashBar.addEventListener("touchend", dashOff);
	dashBar.addEventListener("touchcancel", dashOff);
	dashBar.addEventListener("mousedown", dashOn);
	window.addEventListener("mouseup", dashOff);

	lap = document.createElement("DIV");
	lap.innerHTML = "1/" + LAPS;
	lap.className = "title";
	lap.id = "lap";
	f.appendChild(lap);

	if(gameMode == "tag"){
		lap.innerHTML = fmtTime(tagTime);
		lap.className = "title timer";
		roleEl = document.createElement("DIV");
		roleEl.id = "role";
		f.appendChild(roleEl);
		tagEndsAt = Date.now() + 3000 + tagTime * 1000;
		if(it && players[it]){
			players[it].it = true;
			setOutline(players[it], true);
		}
		showRole();
	}

	setTimeout(function(){
		countDown.innerHTML = "2";
	}, 1000);

	setTimeout(function(){
		countDown.innerHTML = "1";
	}, 2000);

	setTimeout(function(){
		countDown.innerHTML = "GO!";
		gameSortaStarted = false;
	}, 3000);

	setTimeout(function(){
		countDown.innerHTML = "";
	}, 4000);
}

function hostMessage(conn, m){
	var id = conn.peer;
	if(!m || typeof m != "object")
		return;
	if(m.t == "j"){
		if(net.status !== 0 || players[id])
			return;
		var count = Object.keys(players).length;
		if(count >= carPos.length){
			conn.close();
			return;
		}
		var d = newPlayerData();
		d.color = clampNum(m.d && m.d.color, 0, 360, 0);
		d.sat = clampNum(m.d && m.d.sat, 0, 100, 100);
		d.light = clampNum(m.d && m.d.light, 0, 100, 50);
		d.name = String(m.d && m.d.name || "Nerd with No Name").substring(0, 50);
		d.x = carPos[count].x;
		d.y = carPos[count].y;
		net.conns[id] = conn;
		addPlayer(id, d, false);
		conn.send({t: "y", id: id, p: snapshot()});
		broadcast({t: "a", id: id, d: d}, id);
	}else if(m.t == "u"){
		if(!players[id] || !m.d || typeof m.d != "object")
			return;
		players[id].data = m.d;
		broadcast({t: "u", id: id, d: m.d}, id);
	}
}

function startHosting(onCode){
	var attempt = "";
	for(var i = 0; i < 4; i++)
		attempt += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
	var opened = false;
	var peer = new Peer(PEER_PREFIX + attempt);
	peer.on("error", function(e){
		if(opened)
			return;
		peer.destroy();
		if(e.type == "unavailable-id")
			startHosting(onCode);
		else
			document.getElementById("code").innerHTML = "Can't connect";
	});
	peer.on("open", function(){
		opened = true;
		net.peer = peer;
		net.isHost = true;
		net.status = 0;
		code = attempt;
		onCode();
	});
	peer.on("connection", function(conn){
		conn.on("open", function(){
			conn.send({t: "w", s: net.status, m: document.getElementById("trackcode").innerHTML});
		});
		conn.on("data", function(m){
			hostMessage(conn, m);
		});
		conn.on("close", function(){
			if(net.conns[conn.peer] === conn){
				delete net.conns[conn.peer];
				removePlayer(conn.peer);
				broadcast({t: "r", id: conn.peer});
			}
		});
	});
}

function joinLobby(c, fail){
	var done = false;
	var joined = false;
	var peer = new Peer();
	var timer = setTimeout(bail, 10000);
	function bail(){
		if(done)
			return;
		done = true;
		clearTimeout(timer);
		peer.destroy();
		fail();
	}
	peer.on("error", bail);
	peer.on("open", function(){
		var conn = peer.connect(PEER_PREFIX + c, {serialization: "json"});
		conn.on("error", bail);
		conn.on("close", function(){
			if(joined)
				location.reload();
			else
				bail();
		});
		conn.on("data", function(m){
			if(!m || typeof m != "object")
				return;
			if(m.t == "w"){
				if(m.s !== 0){
					bail();
					return;
				}
				document.getElementsByClassName("info")[0].innerHTML = "<div class='info title'>Waiting for the game to start...<div id='code'>" + c + "</div></div>";
				document.getElementById("trackcode").innerHTML = m.m;
				deleteMap();
				eval(loadMap());
				conn.send({t: "j", d: {color: color, sat: sat, light: light, name: name}});
			}else if(m.t == "y"){
				done = true;
				joined = true;
				clearTimeout(timer);
				net.peer = peer;
				net.hostConn = conn;
				net.isHost = false;
				me.id = m.id;
				for(var p in m.p){
					if(p != m.id)
						addPlayer(p, m.p[p], false);
				}
				me.data = m.p[m.id];
				addPlayer(m.id, me.data, true);
			}else if(m.t == "a"){
				addPlayer(m.id, m.d, false);
			}else if(m.t == "u"){
				if(m.id != me.id && players[m.id])
					players[m.id].data = m.d;
			}else if(m.t == "r"){
				if(m.id != me.id)
					removePlayer(m.id);
			}else if(m.t == "tag"){
				tagPlayer(m.id);
			}else if(m.t == "end"){
				endTag(m.w);
			}else if(m.t == "s"){
				startRace(m.cfg, m.it);
			}
		});
	});
}

function host(){
	document.getElementById("host").onclick = null;
	f.style.transform = "translate3d(0, -100vh, 0)";
	setTimeout(function(){
		f.innerHTML = "<div class='info title'>Use this code to join the game!<div id='code'>Loading...</div></div><div id='hostbar'><div id='lobbysettings' onclick='openSettings()'></div><div id='startgame' class='title' onclick='startGame()' ontouchstart='this.click()'>Start!</div></div>";
		f.appendChild(element);
		f.style.transform = "none";
		startHosting(function(){
			document.getElementById("code").innerHTML = code;
			me.id = net.peer.id;
			me.data = newPlayerData();
			addPlayer(me.id, me.data, true);
		});
	}, 1000);

	join();
}

function joinGame(){
	document.getElementById("join").onclick = null;
	f.style.transform = "translate3d(0, -100vh, 0)";
	setTimeout(function(){
		f.innerHTML = "<div class='info title'>Enter a code to join a game!<input id='incode' class='title' onkeyup='codeCheck(event)' ontouchstart='this.focus()'></div>";
		f.appendChild(element);
		f.style.transform = "none";
	}, 1000);
	join();
}

var map, trees, signs, startc, main;

function deleteMap(){
	while(map.children.length > 0)
		map.remove(map.children[0]);
	scene.remove(map);
	while(trees.children.length > 0)
		trees.remove(trees.children[0]);
	scene.remove(trees);
	while(signs.children.length > 0)
		signs.remove(signs.children[0]);
	scene.remove(signs);
	while(startc.children.length > 0)
		startc.remove(startc.children[0]);
	scene.remove(startc);
	while(main.children.length > 0)
		main.remove(main.children[0]);
	scene.remove(main);
}

function loadMap(){
	var racedata = document.getElementById("trackcode").innerHTML.trim().split("|")[0].trim().split(" ");
	var material = new THREE.MeshLambertMaterial({color: new THREE.Color(0xf48342)});
	map = new THREE.Object3D();
	for(var i = 0; i < racedata.length; i++){
		if(racedata[i] == "")
			continue;
		var point1 = new THREE.Vector2(parseInt(racedata[i].split("/")[0].split(",")[0]), parseInt(racedata[i].split("/")[0].split(",")[1]));
		var point2 = new THREE.Vector2(parseInt(racedata[i].split("/")[1].split(",")[0]), parseInt(racedata[i].split("/")[1].split(",")[1]));
		var wall = new THREE.Mesh(
			new THREE.BoxBufferGeometry(point1.distanceTo(point2) * mapscale + 0.3, 1.5, 0.3),
			material
		);
		var angle = Math.atan2((point1.y - point2.y), (point1.x - point2.x));
		wall.position.set(-(point1.x + point2.x) / 2 * mapscale, 0.75, (point1.y + point2.y) / 2 * mapscale);
		wall.rotation.set(0, angle, 0, "YXZ");
		var plane = new THREE.Plane(new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle));
		wall.plane = plane;
		wall.width = point1.distanceTo(point2) * mapscale;
		wall.p1 = point1.multiply(new THREE.Vector2(-mapscale, mapscale));
		wall.p2 = point2.multiply(new THREE.Vector2(-mapscale, mapscale));
		wall.castShadow = true;
		wall.receiveShadow = true;
		map.add(wall);
	}
	scene.add(map);

	trees = new THREE.Object3D();
	var tree = new THREE.Mesh(
		new THREE.CylinderBufferGeometry(0, 4, 15),
		new THREE.MeshLambertMaterial({color: new THREE.Color("#1bad2c")})
	);
	var treedata = document.getElementById("trackcode").innerHTML.trim().split("|")[2].trim().split(" ");
	for(var i = 0; i < treedata.length; i++){
		if(treedata[i] == "")
			continue;
		var t = tree.clone();
		t.position.set(-parseInt(treedata[i].split(",")[0]) * mapscale, 0, parseInt(treedata[i].split(",")[1]) * mapscale);
		var s = Math.random() + 1;
		t.scale.set(s, s, s);
		t.castShadow = true;
		t.receiveShadow = true;
		trees.add(t);
	}
	scene.add(trees);

	signs = new THREE.Object3D();
	var sign = new THREE.Mesh(
		new THREE.ConeBufferGeometry(0.7, 2, 5),
		new THREE.MeshLambertMaterial({color: new THREE.Color("#f00")})
	);
	var signdata = document.getElementById("trackcode").innerHTML.trim().split("|")[3].trim().split(" ");
	for(var i = 0; i < signdata.length; i++){
		if(signdata[i] == "")
			continue;
		var s = sign.clone();
		var da = signdata[i].split("/");
		s.position.set(-parseFloat(da[0].split(",")[0]) * mapscale, parseFloat(da[0].split(",")[1]) + 1, parseFloat(da[0].split(",")[2]) * mapscale);
		s.rotation.set(Math.PI / 2, parseInt(da[1]) / 180 * Math.PI, 0, "YXZ");
		s.castShadow = true;
		s.receiveShadow = true;
		signs.add(s);
	}
	scene.add(signs);

	var startdata = document.getElementById("trackcode").innerHTML.trim().split("|")[1].trim().split(" ");
	startc = new THREE.Object3D();
	for(var i = 0; i < startdata.length; i++){
		if(startdata[i] == "")
			continue;
		var point1 = new THREE.Vector2(parseInt(startdata[i].split("/")[0].split(",")[0]), parseInt(startdata[i].split("/")[0].split(",")[1]));
		var point2 = new THREE.Vector2(parseInt(startdata[i].split("/")[1].split(",")[0]), parseInt(startdata[i].split("/")[1].split(",")[1]));
		var wall = new THREE.Mesh(
			new THREE.BoxBufferGeometry(point1.distanceTo(point2) * mapscale, 0.1, 1),
			new THREE.MeshLambertMaterial({color: new THREE.Color(i == 0 ? "#2580db" : "#db2525")})
		);
		var angle = Math.atan2((point1.y - point2.y), (point1.x - point2.x));
		wall.position.set(-(point1.x + point2.x) / 2 * mapscale, 0, (point1.y + point2.y) / 2 * mapscale);
		wall.rotation.set(0, angle, 0, "YXZ");
		var plane = new THREE.Plane(new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle));
		wall.plane = plane;
		wall.width = point1.distanceTo(point2) * mapscale;
		wall.castShadow = true;
		wall.receiveShadow = true;
		startc.add(wall);
	}
	scene.add(startc);

	main = new THREE.Object3D();

	var stripes = new THREE.TextureLoader().load("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAEklEQVQYV2NgYGD4z/D/////AA/6BPwHejn9AAAAAElFTkSuQmCC");
	stripes.magFilter = THREE.NearestFilter;
	stripes.wrapS = THREE.RepeatWrapping;
	stripes.wrapT = THREE.RepeatWrapping;
	stripes.repeat.set(100, 100);
	var ground = new THREE.Mesh(
		new THREE.PlaneBufferGeometry(1000, 1000),
		new THREE.MeshLambertMaterial({color: new THREE.Color(0x57c115), emissive: new THREE.Color(0x0f0f0f), emissiveMap: stripes})
	);
	ground.rotation.set(-Math.PI / 2, 0, 0);
	ground.receiveShadow = true;
	main.add(ground);

	for(var i = 0; i < 100; i++){
		var cube = new THREE.Mesh(
			new THREE.BoxBufferGeometry(100, 100, 100),
			new THREE.MeshLambertMaterial({color: new THREE.Color("#888"), side: THREE.DoubleSide})
		);
		var dist = Math.random() * MOUNTAIN_DIST + MOUNTAIN_DIST;
		var dir = Math.random() * Math.PI * 2;
		cube.position.set(dist * Math.sin(dir), 0, dist * Math.cos(dir));
		cube.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
		main.add(cube);
	}
	scene.add(main);

	return document.getElementById("trackcode").innerText.trim().split("|")[4];
}

function join(){
	eval(loadMap());

	scene.background = new THREE.Color(0x7fb0ff);

	camera = new THREE.PerspectiveCamera(
		90,
		window.innerWidth / window.innerHeight,
		1,
		1000
	);

	camera.position.set(0, 3, 10);
	scene.add(camera);

	var player = new THREE.Object3D();
	player.position.set(0, 0, 0);

	camera.lookAt(player.position);

	scene.add(player);

	var sun = new THREE.DirectionalLight(0xffffff, 0.7);
	sun.position.set(3000, 2000, -2000);
	sun.castShadow = true;
	sun.shadow.mapSize.width = 2048;
	sun.shadow.mapSize.height = 2048;
	sun.shadow.camera.near = 3000;
	sun.shadow.camera.far = 5000;
	sun.shadow.camera.top = 100;
	sun.shadow.camera.bottom = -100;
	sun.shadow.camera.left = -100;
	sun.shadow.camera.right = 120;
	sun.shadow.bias = 0.00002;
	scene.add(sun);
	scene.add(new THREE.AmbientLight(0xffffff, 0.5));

	var x = 0;
	var ray = new THREE.Raycaster();
	function toXYCoords(pos){
		pos = pos.clone();
		pos.y += 0.5;
		var vector = pos.project(camera);
		vector.x = (vector.x + 1) / 2 * window.innerWidth;
		vector.y = -(vector.y - 1) / 2 * window.innerHeight;
		return vector;
	}
	var windowsize = {x: window.innerWidth, y: window.innerHeight};

	var ray = new THREE.Raycaster();
	ray.near = 0;
	ray.far = 1;

	var ren = renderer;

	var lastTime = performance.now();
	function render(timestamp) {
		requestAnimationFrame(render);
		var timepassed = timestamp - lastTime;
		lastTime = timestamp;
		var warp = timepassed / 16;

		if(gameStarted){
			if(!mobile){
				if(left)
					me.data.steer = Math.PI / 6;
				if(right)
					me.data.steer = -Math.PI / 6;
				if(!(left ^ right))
					me.data.steer = 0;
			}
			me.data.steer = Math.max(-Math.PI / 6, Math.min(Math.PI / 6, me.data.steer));

			var wantDash = (dashKey || dashTouch) && !gameSortaStarted;
			if(dashLocked && dashEnergy >= 0.25)
				dashLocked = false;
			me.data.dash = wantDash && !dashLocked && dashEnergy > 0 ? 1 : 0;
			if(me.data.dash){
				dashEnergy = Math.max(0, dashEnergy - DASH_DRAIN * warp);
				if(dashEnergy == 0)
					dashLocked = true;
			}else
				dashEnergy = Math.min(1, dashEnergy + DASH_REGEN * warp);
			dashFill.style.width = dashEnergy * 100 + "%";

			players[me.id].data = me.data;

			if(!gameSortaStarted){
				for(var p in players){
					var play = players[p];

					play.data.dir += play.data.steer / 10 * warp;

					var accel = SPEED * speedMul * (play.data.dash ? DASH_BOOST : 1);
					play.data.xv += Math.sin(play.data.dir) * accel * warp;
					play.data.yv += Math.cos(play.data.dir) * accel * warp;

					play.data.xv *= Math.pow(0.99, warp);
					play.data.yv *= Math.pow(0.99, warp);

					play.data.x += play.data.xv * warp;
					play.data.y += play.data.yv * warp;

					play.model.position.x = play.data.x + play.data.xv;
					play.model.position.z = play.data.y + play.data.yv;
					play.model.rotation.y = play.data.dir;

					play.model.children[0].rotation.z = Math.PI / 2 - play.data.steer;
					play.model.children[1].rotation.z = Math.PI / 2 - play.data.steer;

					for(var w in map.children){
						var wall = map.children[w];
						var posi = new THREE.Vector2(play.data.x, play.data.y);
						if(Math.abs(wall.plane.distanceToPoint(play.model.position.clone().sub(wall.position))) < WALL_SIZE){
							if(wall.position.clone().distanceTo(play.model.position) < wall.width / 2){
								var vel = new THREE.Vector3(play.data.xv, 0, play.data.yv);
								vel.reflect(wall.plane.normal);
								play.data.xv = vel.x + BOUNCE_CORRECT * wall.plane.normal.x * Math.sign(wall.plane.normal.dot(play.model.position.clone().sub(wall.position)));
								play.data.yv = vel.z + BOUNCE_CORRECT * wall.plane.normal.z * Math.sign(wall.plane.normal.dot(play.model.position.clone().sub(wall.position)));
								while(Math.abs(wall.plane.distanceToPoint(new THREE.Vector3(play.data.x, 0, play.data.y).sub(wall.position))) < WALL_SIZE){
									play.data.x += play.data.xv;
									play.data.y += play.data.yv;
								}
								play.data.xv *= BOUNCE;
								play.data.yv *= BOUNCE;
							}
						}
						if(posi.distanceTo(wall.p1) < WALL_SIZE + 0.1){
							var norm = posi.clone().sub(wall.p1);
							norm = new THREE.Vector3(norm.x, 0, norm.y);
							norm.normalize();
							var vel = new THREE.Vector3(play.data.xv, 0, play.data.yv);
							vel.reflect(norm);
							play.data.xv = vel.x + norm.x * BOUNCE_CORRECT * 1;
							play.data.yv = vel.z + norm.z * BOUNCE_CORRECT * 1;
							while((new THREE.Vector2(play.data.x, play.data.y)).distanceTo(wall.p1) < WALL_SIZE + 0.1){
								play.data.x += play.data.xv;
								play.data.y += play.data.yv;
							}
							play.data.xv *= BOUNCE;
							play.data.yv *= BOUNCE;
						}
						if(posi.distanceTo(wall.p2) < WALL_SIZE + 0.1){
							var norm = posi.clone().sub(wall.p2);
							norm = new THREE.Vector3(norm.x, 0, norm.y);
							norm.normalize();
							var vel = new THREE.Vector3(play.data.xv, 0, play.data.yv);
							vel.reflect(norm);
							play.data.xv = vel.x + norm.x * BOUNCE_CORRECT * 1;
							play.data.yv = vel.z + norm.z * BOUNCE_CORRECT * 1;
							while((new THREE.Vector2(play.data.x, play.data.y)).distanceTo(wall.p2) < WALL_SIZE + 0.1){
								play.data.x += play.data.xv;
								play.data.y += play.data.yv;
							}
							play.data.xv *= BOUNCE;
							play.data.yv *= BOUNCE;
						}
					}

					for(var i in startc.children){
						var cp = startc.children[i];
						if(Math.abs(cp.plane.distanceToPoint(play.model.position.clone().sub(cp.position))) < 1){
							if(cp.position.clone().distanceTo(play.model.position) < cp.width / 2 + 1){
								if(i == 0){
									if(play.data.checkpoint == 1){
										play.data.checkpoint = 0;
										play.data.lap++;
									}
								}else
									play.data.checkpoint = 1;
							}
						}
					}

					if(gameMode == "race" && play.data.lap > LAPS && document.getElementById("countdown").innerHTML == ""){
						document.getElementById("countdown").style.fontSize = "25vmin";
						document.getElementById("countdown").innerHTML = play.data.name.replaceAll("<", "&lt;") + " Won!";
					}

					for(var pl in players){
						if(play != players[pl] && play.model.position.distanceTo(players[pl].model.position) < 2){
							var ply = players[pl];
							var temp = new THREE.Vector2(play.data.xv, play.data.yv);
							var temp2 = new THREE.Vector2(ply.data.xv, ply.data.yv);
							ply.data.xv -= temp.x;
							ply.data.yv -= temp.y;
							play.data.xv -= temp2.x;
							play.data.yv -= temp2.y;
							var norm = (new THREE.Vector2(play.data.x, play.data.y)).sub(new THREE.Vector2(ply.data.x, ply.data.y));
							norm = new THREE.Vector3(norm.x, 0, norm.y);
							norm.normalize();
							var vel = new THREE.Vector3(play.data.xv, 0, play.data.yv);
							var vel2 = new THREE.Vector3(ply.data.xv, 0, ply.data.yv);
							vel.reflect(norm);
							vel2.reflect(norm);
							ply.data.xv += COLLISION * vel2.x;
							ply.data.yv += COLLISION * vel2.z;
							play.data.xv += COLLISION * vel.x;
							play.data.yv += COLLISION * vel.z;
							ply.data.xv += temp.x;
							ply.data.yv += temp.y;
							play.data.xv += temp2.x;
							play.data.yv += temp2.y;
							while((new THREE.Vector2(play.data.x, play.data.y)).distanceTo(new THREE.Vector2(ply.data.x, ply.data.y)) < 2){
								play.data.x += play.data.xv;
								play.data.y += play.data.yv;
							}
						}
					}

					if(play.model.position.distanceTo(new THREE.Vector3()) > OOB_DIST){
						play.data.x = 0;
						play.data.y = 0;
					}
				}

				if(net.isHost && gameMode == "tag" && !gameOver)
					checkTags();
			}

			var target = new THREE.Vector3(
				me.model.position.x + Math.sin(-me.model.rotation.y) * 5,
				3,
				me.model.position.z + -Math.cos(-me.model.rotation.y) * 5
			);
			camera.position.set(
				camera.position.x * Math.pow(CAMERA_LAG, warp) + target.x * (1 - Math.pow(CAMERA_LAG, warp)),
				3,
				camera.position.z * Math.pow(CAMERA_LAG, warp) + target.z * (1 - Math.pow(CAMERA_LAG, warp))
			);
			camera.lookAt(me.model.position);
			camera.fov += ((me.data.dash ? DASH_FOV : BASE_FOV) - camera.fov) * (1 - Math.pow(0.9, warp));

			sendMe();

			if(gameMode == "tag")
				lap.innerHTML = fmtTime(Math.min(tagTime, Math.max(0, Math.ceil((tagEndsAt - Date.now()) / 1000))));
			else
				lap.innerHTML = me.data.lap <= LAPS ? me.data.lap + "/" + LAPS : "";
		}else{
			camera.position.set(50 * Math.sin(x), 20, 50 * Math.cos(x));
			camera.lookAt(player.position);
		}

		x += 0.01;

		camera.updateMatrix();
		camera.updateMatrixWorld();
		camera.updateProjectionMatrix();
		var frustum = new THREE.Frustum();
		frustum.setFromMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
		for(var i = 0; i < labels.length; i++){
			var label = labels[i];
			if(frustum.containsPoint(label.position)){
				var vec = toXYCoords(label.position);
				label.style.left = vec.x + "px";
				label.style.top = vec.y + "px";
				label.style.zIndex = 99999 - Math.floor(camera.position.distanceTo(label.position) * 10);
				label.style.display = "inline-block";
			}else
				label.style.display = "none";
		}

		if(windowsize.x != window.innerWidth || windowsize.y != window.innerHeight){
			windowsize = {x: window.innerWidth, y: window.innerHeight};
			onWindowResize();
		}

		ren.render(scene, camera);
		MODS();
	}

	render(performance.now());

	window.addEventListener("resize", onWindowResize, false);
	window.addEventListener("orientationchange", onWindowResize, false);

	function onWindowResize(){
		function orientCamera(){
			camera.aspect = window.innerWidth / window.innerHeight;
			renderer.setSize(window.innerWidth, window.innerHeight);
		}
		orientCamera();
		setTimeout(orientCamera, 0);
	}
}
function codeCheck(){
	var incode = document.getElementById("incode");
	if(incode.value.length == 4){
		incode.onkeyup = null;
		code = incode.value.toUpperCase();
		joinLobby(code, function(){
			incode.onkeyup = codeCheck;
		});
	}else{
		incode.onkeyup = codeCheck;
		if(incode.value.length > 4)
			incode.value = incode.value.substring(0, 4);
	}
}

function startGame(){
	if(!net.isHost || net.status !== 0)
		return;
	net.status = 1;
	var c = sanitizeCfg(cfg);
	var it = null;
	runnersAtStart = 0;
	if(c.mode == "tag"){
		var ids = Object.keys(players);
		it = ids[Math.floor(Math.random() * ids.length)];
		runnersAtStart = ids.length - 1;
	}
	broadcast({t: "s", cfg: c, it: it});
	startRace(c, it);
}

window.onkeydown = function(e){
	if(e.keyCode == 37)
		left = true;
	if(e.keyCode == 39)
		right = true;
	if(e.keyCode == 69)
		dashKey = true;
}

window.onkeyup = function(e){
	if(e.keyCode == 37)
		left = false;
	if(e.keyCode == 39)
		right = false;
	if(e.keyCode == 69)
		dashKey = false;
}

document.body.onkeydown = function(e){
	if(e.keyCode == 73 && (e.ctrlKey || e.metaKey))
		document.getElementById("trackcode").innerText = prompt("Track data?")
}
