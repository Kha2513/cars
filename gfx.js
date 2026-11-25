var gfx = {quality: "high", fps: 0, scenery: true, names: true, showFps: false, previews: true};

(function(){
	if(/Mobile|Android/i.test(navigator.userAgent))
		gfx.quality = "medium";
	try{
		var s = JSON.parse(localStorage.getItem("carsGfx"));
		if(s){
			if(["low", "medium", "high"].indexOf(s.quality) >= 0)
				gfx.quality = s.quality;
			if([0, 30, 60].indexOf(s.fps) >= 0)
				gfx.fps = s.fps;
			gfx.scenery = s.scenery !== false;
			gfx.names = s.names !== false;
			gfx.showFps = s.showFps === true;
			gfx.previews = s.previews !== false;
		}
	}catch(e){}
})();

function saveGfx(){
	try{
		localStorage.setItem("carsGfx", JSON.stringify(gfx));
	}catch(e){}
}

function gfxPixelRatio(){
	var d = window.devicePixelRatio || 1;
	return gfx.quality == "low" ? 0.6 : gfx.quality == "medium" ? Math.min(d, 1.25) : Math.min(d, 2);
}
