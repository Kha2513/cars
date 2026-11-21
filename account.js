var authTab = "login", authInfo = null, authSaved = false, authUserVal = "", authBusy = false;
var applyingCloud = false, cloudTimer = null;
var defaultTrack = document.getElementById("trackcode").innerHTML;
var trackName = "", trackTab = "shared", trackItems = [];

function localProfile(){
	return {name: nameBox.value, color: color, sat: sat, light: light, face: faceData, side: sideData};
}

function cloudSaveSoon(){
	if(!window.cloud || !cloud.user || applyingCloud)
		return;
	clearTimeout(cloudTimer);
	cloudTimer = setTimeout(function(){
		cloud.saveProfile(localProfile()).catch(function(){});
	}, 1500);
}

function applyCloudProfile(p){
	applyingCloud = true;
	if(typeof p.name == "string" && p.name)
		nameBox.value = p.name.substring(0, 50);
	color = Math.floor(clampNum(p.color, 0, 360, color));
	sat = Math.round(clampNum(p.sat, 0, 100, sat));
	light = Math.round(clampNum(p.light, 0, 100, light));
	faceData = cleanFace(p.face);
	sideData = cleanFace(p.side);
	updateColor();
	applyingCloud = false;
}

function renderAccount(){
	var el = document.getElementById("account");
	var eb = document.getElementById("editbtn");
	if(!el)
		return;
	var label = document.createElement("SPAN");
	label.className = "acctext";
	el.innerHTML = "";
	el.appendChild(label);
	if(!window.cloud || !cloud.enabled){
		label.textContent = "Accounts are not set up yet";
	}else if(!cloud.ready){
		label.textContent = "Loading account...";
	}else if(cloud.user){
		label.textContent = "Hi, " + cloud.user.username;
		el.insertAdjacentHTML("beforeend", "<div class='cfgbtn small' data-act='logout'>Log out</div>");
	}else{
		label.textContent = "Guest";
		el.insertAdjacentHTML("beforeend", "<div class='cfgbtn small' data-act='login'>Log in</div><div class='cfgbtn small' data-act='register'>Register</div>");
	}
	if(eb)
		eb.className = "cfgbtn small" + (window.cloud && cloud.user ? "" : " locked");
}

function accountClick(e){
	var act = e.target.getAttribute ? e.target.getAttribute("data-act") : null;
	if(act == "login")
		openAuth("login", "");
	else if(act == "register")
		openAuth("register", "");
	else if(act == "logout")
		cloud.logout();
}

function copyText(t){
	function fallback(){
		var a = document.createElement("TEXTAREA");
		a.value = t;
		document.body.appendChild(a);
		a.select();
		try{
			document.execCommand("copy");
		}catch(e){}
		document.body.removeChild(a);
	}
	if(navigator.clipboard && navigator.clipboard.writeText)
		navigator.clipboard.writeText(t).catch(fallback);
	else
		fallback();
}

function closeAuth(){
	var el = document.getElementById("auth");
	if(el)
		el.parentNode.removeChild(el);
}

function setAuthMsg(m){
	var el = document.getElementById("authmsg");
	if(el)
		el.textContent = m;
}

function renderAuth(msg){
	var el = document.getElementById("auth");
	if(!el)
		return;
	var html = "<div class='modalbox title'><div class='modaltitle'>Account</div>";
	if(!window.cloud || !cloud.enabled){
		msg = "Accounts are not set up yet. Add your Firebase config to firebase-config.js.";
		html += "<div class='modalmsg' id='authmsg'></div><div class='modalrow'><div class='cfgbtn small' data-act='close'>Close</div></div></div>";
	}else if(authTab == "code"){
		html += "<div class='modalmsg'>This is your login code. Save it now. It is the only way to log in and it cannot be recovered.</div><div id='codebox'></div><div class='modalrow'><div class='cfgbtn small' id='authcopy' data-act='copy'>Copy</div><div class='cfgbtn small' data-act='download'>Save .txt</div></div><div class='modalrow'><div class='cfgbtn" + (authSaved ? "" : " locked") + "' id='authgo' data-act='continue'>Continue</div></div></div>";
	}else{
		var login = authTab == "login";
		html += "<div id='authtabs'><div class='cfgbtn small" + (login ? " sel" : "") + "' data-act='tab' data-val='login'>Log in</div><div class='cfgbtn small" + (login ? "" : " sel") + "' data-act='tab' data-val='register'>Register</div></div><div class='modalmsg' id='authmsg'></div>";
		html += "<input class='field' id='authuser' maxlength='16' placeholder='Username' autocomplete='off' autocapitalize='off'>";
		if(login)
			html += "<input class='field' id='authcode' placeholder='Login code' autocomplete='off' autocapitalize='characters'><input type='file' id='authfile' accept='.txt,text/plain' style='display:none'>";
		html += "<div class='modalrow'>" + (login ? "<div class='cfgbtn small' data-act='file'>Load .txt</div>" : "") + "<div class='cfgbtn small' id='authgo' data-act='submit'>" + (login ? "Log in" : "Create account") + "</div><div class='cfgbtn small' data-act='close'>Cancel</div></div></div>";
	}
	el.innerHTML = html;
	setAuthMsg(msg || "");
	var cb = document.getElementById("codebox");
	if(cb && authInfo)
		cb.textContent = authInfo.code;
	var u = document.getElementById("authuser");
	if(u)
		u.value = authUserVal;
	var fi = document.getElementById("authfile");
	if(fi)
		fi.addEventListener("change", authFile);
}

function authFile(e){
	var file = e.target.files && e.target.files[0];
	if(!file)
		return;
	var r = new FileReader();
	r.onload = function(){
		var text = String(r.result);
		var u = text.match(/Username:\s*([A-Za-z0-9_]+)/i);
		var c = text.match(/([A-Z0-9]{4}(?:-[A-Z0-9]{4}){4})/i);
		if(u)
			document.getElementById("authuser").value = u[1];
		if(c)
			document.getElementById("authcode").value = c[1].toUpperCase();
		setAuthMsg(u && c ? "Loaded." : "Could not find a login code in that file.");
	};
	r.readAsText(file.slice(0, 5000));
}

function authSubmit(){
	if(authBusy || !window.cloud || !cloud.enabled)
		return;
	var u = document.getElementById("authuser").value;
	authUserVal = u;
	authBusy = true;
	setAuthMsg("Working...");
	var p;
	if(authTab == "login"){
		p = cloud.login(u, document.getElementById("authcode").value).then(function(){
			authBusy = false;
			closeAuth();
		});
	}else{
		var prof = localProfile();
		if(!prof.name)
			prof.name = u.trim();
		p = cloud.register(u, prof).then(function(info){
			authBusy = false;
			authInfo = info;
			authTab = "code";
			authSaved = false;
			renderAuth("");
		});
	}
	p.catch(function(e){
		authBusy = false;
		renderAuth(e.message);
	});
}

function markSaved(){
	authSaved = true;
	var go = document.getElementById("authgo");
	if(go)
		go.className = "cfgbtn";
}

function authClick(e){
	var t = e.target;
	var act = t.getAttribute ? t.getAttribute("data-act") : null;
	if(t.id == "auth"){
		if(authTab != "code")
			closeAuth();
		return;
	}
	if(act == "close")
		closeAuth();
	else if(act == "tab"){
		authTab = t.getAttribute("data-val") == "register" ? "register" : "login";
		renderAuth("");
	}else if(act == "submit")
		authSubmit();
	else if(act == "file")
		document.getElementById("authfile").click();
	else if(act == "copy"){
		copyText(authInfo.code);
		t.textContent = "Copied";
		markSaved();
	}else if(act == "download"){
		var blob = new Blob(["Kha2513's Racing Game login\nUsername: " + authInfo.username + "\nCode: " + authInfo.code + "\n"], {type: "text/plain"});
		var a = document.createElement("A");
		a.href = URL.createObjectURL(blob);
		a.download = "racing-game-login-" + authInfo.username + ".txt";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		markSaved();
	}else if(act == "continue"){
		if(authSaved){
			authInfo = null;
			closeAuth();
		}
	}
}

function openAuth(tab, msg){
	closeAuth();
	authTab = tab || "login";
	authBusy = false;
	var el = document.createElement("DIV");
	el.id = "auth";
	el.className = "overlay";
	el.addEventListener("click", authClick);
	el.addEventListener("keydown", function(e){
		if(e.keyCode == 13 && e.target.tagName == "INPUT")
			authSubmit();
	});
	f.appendChild(el);
	renderAuth(msg);
}

function updateTrackBtn(){
	var b = document.getElementById("trackbtn");
	if(b)
		b.textContent = trackName ? "Track: " + trackName : "Tracks";
}

function closeTracks(){
	var el = document.getElementById("tracks");
	if(el)
		el.parentNode.removeChild(el);
}

function renderTracks(){
	var el = document.getElementById("tracks");
	if(!el)
		return;
	var mine = window.cloud && cloud.user;
	if(!mine && trackTab == "mine")
		trackTab = "shared";
	el.innerHTML = "<div class='modalbox title'><div class='modaltitle'>Tracks</div><div id='authtabs'><div class='cfgbtn small" + (trackTab == "shared" ? " sel" : "") + "' data-act='ttab' data-val='shared'>Shared</div>" + (mine ? "<div class='cfgbtn small" + (trackTab == "mine" ? " sel" : "") + "' data-act='ttab' data-val='mine'>Mine</div>" : "") + "</div><div class='modalmsg' id='trackmsg'></div><div id='tracklist'></div><div class='modalrow'><div class='cfgbtn small' data-act='default'>Default track</div><div class='cfgbtn small' data-act='tclose'>Close</div></div></div>";
}

function fillTracks(list, msg){
	var box = document.getElementById("tracklist");
	var m = document.getElementById("trackmsg");
	if(!box)
		return;
	trackItems = list;
	box.innerHTML = "";
	m.textContent = msg || (list.length ? "" : "Nothing here yet.");
	for(var i = 0; i < list.length; i++){
		var row = document.createElement("DIV");
		row.className = "trow";
		var info = document.createElement("DIV");
		info.className = "tinfo";
		var b = document.createElement("B");
		b.textContent = list[i].name;
		var by = document.createElement("SPAN");
		by.textContent = "by " + list[i].ownerName;
		info.appendChild(b);
		info.appendChild(by);
		var use = document.createElement("DIV");
		use.className = "cfgbtn small";
		use.textContent = "Use";
		use.setAttribute("data-act", "use");
		use.setAttribute("data-i", i);
		row.appendChild(info);
		row.appendChild(use);
		box.appendChild(row);
	}
}

function loadTrackList(){
	var m = document.getElementById("trackmsg");
	if(!window.cloud || !cloud.enabled){
		m.textContent = "Shared tracks need accounts to be set up.";
		return;
	}
	m.textContent = "Loading...";
	var tab = trackTab;
	var p = tab == "mine" ? cloud.myTracks() : cloud.publicTracks();
	p.then(function(list){
		if(tab == trackTab)
			fillTracks(list, "");
	}).catch(function(e){
		var mm = document.getElementById("trackmsg");
		if(mm)
			mm.textContent = e.message;
	});
}

function tracksClick(e){
	var t = e.target;
	var act = t.getAttribute ? t.getAttribute("data-act") : null;
	if(t.id == "tracks" || act == "tclose"){
		closeTracks();
	}else if(act == "ttab"){
		trackTab = t.getAttribute("data-val") == "mine" ? "mine" : "shared";
		renderTracks();
		loadTrackList();
	}else if(act == "default"){
		document.getElementById("trackcode").innerHTML = defaultTrack;
		trackName = "";
		updateTrackBtn();
		closeTracks();
	}else if(act == "use"){
		var item = trackItems[Number(t.getAttribute("data-i"))];
		var clean = item ? cloud.cleanTrack(item.data) : null;
		if(!clean){
			document.getElementById("trackmsg").textContent = "That track has bad data.";
			return;
		}
		document.getElementById("trackcode").innerHTML = clean;
		trackName = String(item.name).substring(0, 40);
		updateTrackBtn();
		closeTracks();
	}
}

function openTracks(){
	closeTracks();
	var el = document.createElement("DIV");
	el.id = "tracks";
	el.className = "overlay";
	el.addEventListener("click", tracksClick);
	f.appendChild(el);
	renderTracks();
	loadTrackList();
}

function openEditor(){
	if(!window.cloud || !cloud.enabled || !cloud.user){
		openAuth("login", cloud && cloud.enabled ? "Log in to use the editor." : "");
		return;
	}
	window.open(location.href.includes("index.html") ? "editor/index.html" : "editor");
}

function openHelp(){
	window.open(location.href.includes("index.html") ? "help/index.html" : "help");
}

document.getElementById("account").addEventListener("click", accountClick);
renderAccount();
updateTrackBtn();

if(window.cloud){
	cloud.onChange(function(user, profile){
		renderAccount();
		if(user && profile)
			applyCloudProfile(profile);
		else if(user)
			cloud.saveProfile(localProfile()).catch(function(){});
	});
}
