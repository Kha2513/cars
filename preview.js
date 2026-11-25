var previewItems = [];
var previewRAF = 0;
var previewLast = 0;
var previewImages = {};
var PREVIEW_BOXES = [
	{c: [0, 0, 0], h: [0.5, 0.5, 1], body: true},
	{c: [0.6, -0.1, 0.7], h: [0.1, 0.5, 0.5]},
	{c: [-0.6, -0.1, 0.7], h: [0.1, 0.5, 0.5]},
	{c: [0.6, -0.1, -0.7], h: [0.1, 0.5, 0.5]},
	{c: [-0.6, -0.1, -0.7], h: [0.1, 0.5, 0.5]}
];

function previewImage(src){
	if(!src)
		return null;
	var im = previewImages[src];
	if(!im){
		im = new Image();
		im.src = src;
		previewImages[src] = im;
	}
	return im;
}

function previewReady(im){
	return !!(im && im.complete && im.naturalWidth);
}

function parseSegments(text){
	var out = [];
	var parts = String(text || "").trim().split(" ");
	for(var i = 0; i < parts.length; i++){
		var m = parts[i].match(/^(-?\d+),(-?\d+)\/(-?\d+),(-?\d+)$/);
		if(m)
			out.push([Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]);
	}
	return out;
}

function makeCarPreview(u, w, h){
	var c = document.createElement("CANVAS");
	c.width = w || 144;
	c.height = h || 96;
	c.className = "preview";
	previewItems.push({canvas: c, kind: "car", off: Math.random() * 6.28, color: clampNum(u.color, 0, 360, 0), sat: clampNum(u.sat, 0, 100, 100), light: clampNum(u.light, 0, 100, 50), face: cleanFace(u.face), side: cleanFace(u.side)});
	startPreviews();
	return c;
}

function makeTrackPreview(data, w, h){
	var c = document.createElement("CANVAS");
	c.width = w || 144;
	c.height = h || 96;
	c.className = "preview";
	var sections = String(data || "").split("|");
	var walls = parseSegments(sections[0]);
	var starts = parseSegments(sections[1]);
	var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
	for(var i = 0; i < walls.length; i++){
		minX = Math.min(minX, walls[i][0], walls[i][2]);
		maxX = Math.max(maxX, walls[i][0], walls[i][2]);
		minY = Math.min(minY, walls[i][1], walls[i][3]);
		maxY = Math.max(maxY, walls[i][1], walls[i][3]);
	}
	var cx = walls.length ? (minX + maxX) / 2 : 0;
	var cy = walls.length ? (minY + maxY) / 2 : 0;
	var r = 1;
	for(var j = 0; j < walls.length; j++){
		r = Math.max(r, Math.hypot(walls[j][0] - cx, walls[j][1] - cy), Math.hypot(walls[j][2] - cx, walls[j][3] - cy));
	}
	previewItems.push({canvas: c, kind: "track", off: Math.random() * 6.28, walls: walls, starts: starts, cx: cx, cy: cy, r: r});
	startPreviews();
	return c;
}

function drawTrackPreview(ctx, w, h, item, ang){
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, w, h);
	ctx.fillStyle = "rgba(87, 193, 21, 0.35)";
	ctx.fillRect(0, 0, w, h);
	var s = Math.min(w, h) * 0.46 / item.r;
	ctx.save();
	ctx.translate(w / 2, h / 2);
	ctx.scale(1, 0.6);
	ctx.rotate(ang);
	ctx.lineCap = "round";
	var groups = [[item.walls, "#f48342", 2.6], [item.starts, "#2580db", 3.2]];
	for(var g = 0; g < groups.length; g++){
		ctx.strokeStyle = groups[g][1];
		ctx.lineWidth = groups[g][2];
		ctx.beginPath();
		for(var i = 0; i < groups[g][0].length; i++){
			var sg = groups[g][0][i];
			ctx.moveTo((sg[0] - item.cx) * s, (sg[1] - item.cy) * s);
			ctx.lineTo((sg[2] - item.cx) * s, (sg[3] - item.cy) * s);
		}
		ctx.stroke();
	}
	ctx.restore();
}

function drawCarPreview(ctx, w, h, item, ang){
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, w, h);
	var sa = Math.sin(ang), ca = Math.cos(ang);
	var pitch = 0.45, sp = Math.sin(pitch), cp = Math.cos(pitch);
	var S = Math.min(w * 0.32, h * 0.41);
	function proj(x, y, z){
		var rx = x * ca + z * sa;
		var rz = -x * sa + z * ca;
		return [w / 2 + rx * S, h / 2 - (y * cp - rz * sp) * S, y * sp + rz * cp];
	}
	var FACES = [
		{n: [0, 0, 1], k: "front", p: [[-1, 1, 1], [1, 1, 1], [1, -1, 1], [-1, -1, 1]]},
		{n: [0, 0, -1], k: "back", p: [[1, 1, -1], [-1, 1, -1], [-1, -1, -1], [1, -1, -1]]},
		{n: [-1, 0, 0], k: "side", p: [[-1, 1, -1], [-1, 1, 1], [-1, -1, 1], [-1, -1, -1]]},
		{n: [1, 0, 0], k: "side", p: [[1, 1, -1], [1, 1, 1], [1, -1, 1], [1, -1, -1]]},
		{n: [0, 1, 0], k: "top", p: [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]]}
	];
	var draw = [];
	for(var b = 0; b < PREVIEW_BOXES.length; b++){
		var box = PREVIEW_BOXES[b];
		for(var f = 0; f < FACES.length; f++){
			var face = FACES[f];
			var nz = -face.n[0] * sa + face.n[2] * ca;
			if(face.n[1] * sp + nz * cp <= 0)
				continue;
			var pts = [];
			var depth = 0;
			for(var q = 0; q < 4; q++){
				var P = proj(box.c[0] + face.p[q][0] * box.h[0], box.c[1] + face.p[q][1] * box.h[1], box.c[2] + face.p[q][2] * box.h[2]);
				pts.push(P);
				depth += P[2] / 4;
			}
			var lit = Math.max(0, face.n[0] * 0.3 + face.n[1] * 0.8 + face.n[2] * 0.5);
			draw.push({pts: pts, depth: depth, lit: lit, face: face, body: !!box.body});
		}
	}
	draw.sort(function(a, c){
		return a.depth - c.depth;
	});
	for(var d = 0; d < draw.length; d++){
		var it = draw[d];
		var pts2 = it.pts;
		ctx.beginPath();
		ctx.moveTo(pts2[0][0], pts2[0][1]);
		for(var m = 1; m < 4; m++)
			ctx.lineTo(pts2[m][0], pts2[m][1]);
		ctx.closePath();
		var shade = 0.6 + 0.4 * it.lit;
		ctx.fillStyle = it.body ? "hsl(" + item.color + ", " + item.sat + "%, " + Math.round(item.light * shade) + "%)" : "hsl(0, 0%, " + Math.round(18 * shade) + "%)";
		ctx.fill();
		if(it.body){
			var src = it.face.k == "front" ? item.face : it.face.k == "side" ? item.side : null;
			var im = previewImage(src);
			if(previewReady(im)){
				var ux = pts2[1][0] - pts2[0][0], uy = pts2[1][1] - pts2[0][1];
				var vx = pts2[3][0] - pts2[0][0], vy = pts2[3][1] - pts2[0][1];
				ctx.save();
				ctx.imageSmoothingEnabled = false;
				ctx.setTransform(ux / im.naturalWidth, uy / im.naturalWidth, vx / im.naturalHeight, vy / im.naturalHeight, pts2[0][0], pts2[0][1]);
				ctx.drawImage(im, 0, 0);
				ctx.restore();
			}
		}
	}
}

function previewVisible(item){
	var r = item.canvas.getBoundingClientRect();
	if(!r.width && !r.height)
		return false;
	if(r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth)
		return false;
	var el = item.canvas.parentNode;
	while(el && el !== document.body){
		if(el.id && /list$/.test(el.id)){
			var lr = el.getBoundingClientRect();
			if(r.bottom < lr.top || r.top > lr.bottom)
				return false;
			break;
		}
		el = el.parentNode;
	}
	return true;
}

function previewFrame(now){
	previewRAF = 0;
	var live = [];
	for(var i = 0; i < previewItems.length; i++){
		var cv = previewItems[i].canvas;
		if(cv.isConnected !== undefined ? cv.isConnected : document.body.contains(cv))
			live.push(previewItems[i]);
	}
	previewItems = live;
	if(!live.length)
		return;
	if(!document.hidden && now - previewLast >= 33){
		previewLast = now;
		for(var j = 0; j < live.length; j++){
			var it = live[j];
			var animate = typeof gfx == "undefined" || gfx.previews !== false;
			if(!animate && it.drawn)
				continue;
			if(!previewVisible(it))
				continue;
			it.drawn = true;
			var ctx = it.canvas.getContext("2d");
			var ang = animate ? now / 1000 * 0.9 + it.off : it.off;
			if(it.kind == "car")
				drawCarPreview(ctx, it.canvas.width, it.canvas.height, it, ang);
			else
				drawTrackPreview(ctx, it.canvas.width, it.canvas.height, it, ang);
		}
	}
	previewRAF = requestAnimationFrame(previewFrame);
}

function startPreviews(){
	if(!previewRAF)
		previewRAF = requestAnimationFrame(previewFrame);
}
