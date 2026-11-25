var authTab = "login", authInfo = null, authSaved = false, authUserVal = "", authBusy = false;
var applyingCloud = false, cloudTimer = null;
var defaultTrack = document.getElementById("trackcode").innerHTML;
var trackName = "", trackTab = "shared", trackItems = [], userItems = [], profileTracks = [], adminList = [], adminTracks = [], acctState = "main", setTab = "game", draft = {}, adminTab = "users", bannerDraft = {text: "", kind: "info", enabled: true};

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
		el.insertAdjacentHTML("beforeend", "<div class='cfgbtn small' data-act='profile'>Profile</div>" + (cloud.isAdmin ? "<div class='cfgbtn small' data-act='admin'>Admin</div>" : ""));
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
	else if(act == "profile")
		openProfile(myProfileUser());
	else if(act == "admin")
		openAdmin();
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
	function tabBtn(val, label){
		return "<div class='cfgbtn small" + (trackTab == val ? " sel" : "") + "' data-act='ttab' data-val='" + val + "'>" + label + "</div>";
	}
	el.innerHTML = "<div class='modalbox title'><div class='modaltitle'>Online</div><div id='authtabs'>" + tabBtn("shared", "Tracks") + (mine ? tabBtn("mine", "Mine") : "") + tabBtn("users", "Users") + "</div><div class='modalmsg' id='trackmsg'></div><div id='tracklist'></div><div class='modalrow'>" + (trackTab == "users" ? "" : "<div class='cfgbtn small' data-act='default'>Default track</div>") + "<div class='cfgbtn small' data-act='tclose'>Close</div></div></div>";
}

function rowFor(info, buttons){
	var row = document.createElement("DIV");
	row.className = "trow";
	if(info.preview)
		row.appendChild(info.preview);
	var box = document.createElement("DIV");
	box.className = "tinfo";
	box.appendChild(info.b);
	if(info.span)
		box.appendChild(info.span);
	row.appendChild(box);
	for(var i = 0; i < buttons.length; i++){
		var btn = document.createElement("DIV");
		btn.className = "cfgbtn small";
		btn.textContent = buttons[i][0];
		btn.setAttribute("data-act", buttons[i][1]);
		btn.setAttribute("data-i", buttons[i][2]);
		row.appendChild(btn);
	}
	return row;
}

function textEl(tag, text){
	var el = document.createElement(tag);
	el.textContent = text;
	return el;
}

function fillTracks(list, msg){
	var box = document.getElementById("tracklist");
	var m = document.getElementById("trackmsg");
	if(!box)
		return;
	trackItems = list;
	box.innerHTML = "";
	m.textContent = msg || (list.length ? (trackName ? "Using: " + trackName : "") : "Nothing here yet.");
	for(var i = 0; i < list.length; i++)
		box.appendChild(rowFor({preview: makeTrackPreview(list[i].data), b: textEl("B", list[i].name), span: textEl("SPAN", "by " + list[i].ownerName)}, [["Use", "use", i]]));
}

function userTags(u){
	return (u.owner ? " [owner]" : u.admin ? " [admin]" : "") + (u.banned ? " [banned]" : "");
}

function fillUsers(list){
	var box = document.getElementById("tracklist");
	var m = document.getElementById("trackmsg");
	if(!box)
		return;
	userItems = list;
	box.innerHTML = "";
	m.textContent = list.length ? "" : "No users yet.";
	for(var i = 0; i < list.length; i++)
		box.appendChild(rowFor({preview: makeCarPreview(list[i]), b: textEl("B", list[i].username), span: textEl("SPAN", userTags(list[i]).trim())}, [["View", "view", i]]));
}

function loadTrackList(){
	var m = document.getElementById("trackmsg");
	if(!window.cloud || !cloud.enabled){
		m.textContent = "Online features need accounts to be set up.";
		return;
	}
	m.textContent = "Loading...";
	var tab = trackTab;
	var p = tab == "mine" ? cloud.myTracks() : tab == "users" ? cloud.users() : cloud.publicTracks();
	p.then(function(list){
		if(tab != trackTab)
			return;
		if(tab == "users")
			fillUsers(list);
		else
			fillTracks(list, "");
	}).catch(function(e){
		var mm = document.getElementById("trackmsg");
		if(mm)
			mm.textContent = e.message;
	});
}

function useTrackItem(item){
	var clean = item ? cloud.cleanTrack(item.data) : null;
	if(!clean)
		return false;
	document.getElementById("trackcode").innerHTML = clean;
	trackName = String(item.name).substring(0, 40);
	return true;
}

function tracksClick(e){
	var t = e.target;
	var act = t.getAttribute ? t.getAttribute("data-act") : null;
	if(t.id == "tracks" || act == "tclose"){
		closeTracks();
	}else if(act == "ttab"){
		trackTab = t.getAttribute("data-val") == "mine" ? "mine" : t.getAttribute("data-val") == "users" ? "users" : "shared";
		renderTracks();
		loadTrackList();
	}else if(act == "default"){
		document.getElementById("trackcode").innerHTML = defaultTrack;
		trackName = "";
		closeTracks();
	}else if(act == "use"){
		if(useTrackItem(trackItems[Number(t.getAttribute("data-i"))]))
			closeTracks();
		else
			document.getElementById("trackmsg").textContent = "That track has bad data.";
	}else if(act == "view"){
		openProfile(userItems[Number(t.getAttribute("data-i"))]);
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

function closeProfile(){
	var el = document.getElementById("profile");
	if(el)
		el.parentNode.removeChild(el);
}

function profileClick(e){
	var t = e.target;
	var act = t.getAttribute ? t.getAttribute("data-act") : null;
	if(t.id == "profile" || act == "pclose"){
		closeProfile();
	}else if(act == "puse"){
		if(useTrackItem(profileTracks[Number(t.getAttribute("data-i"))])){
			closeProfile();
			closeTracks();
		}
	}
}

function openProfile(u){
	if(!u)
		return;
	closeProfile();
	var el = document.createElement("DIV");
	el.id = "profile";
	el.className = "overlay";
	el.addEventListener("click", profileClick);
	el.innerHTML = "<div class='modalbox title'><div class='modaltitle' id='ptitle'></div><div class='modalmsg' id='pname'></div><div class='modalmsg' id='pbio'></div><div id='pcars'></div><div class='modalmsg' id='ptracksmsg'>Loading tracks...</div><div id='ptracklist'></div><div class='modalrow'><div class='cfgbtn small' data-act='pclose'>Close</div></div></div>";
	f.appendChild(el);
	if(applyProfileStyle(el.firstChild, u.style))
		el.className = "overlay cf";
	document.getElementById("ptitle").textContent = u.username;
	document.getElementById("pname").textContent = (u.name ? u.name : "") + userTags(u);
	document.getElementById("pbio").textContent = u.bio;
	document.getElementById("pcars").appendChild(makeCarPreview(u, 270, 150));
	cloud.userTracks(u.id).then(function(list){
		var box = document.getElementById("ptracklist");
		if(!box)
			return;
		profileTracks = list;
		document.getElementById("ptracksmsg").textContent = list.length ? "Shared tracks" : "No shared tracks.";
		for(var i = 0; i < list.length; i++)
			box.appendChild(rowFor({preview: makeTrackPreview(list[i].data, 108, 72), b: textEl("B", list[i].name)}, [["Use", "puse", i]]));
	}).catch(function(err){
		var m = document.getElementById("ptracksmsg");
		if(m)
			m.textContent = err.message;
	});
}

var CSS_PROPS = ["background", "background-color", "background-image", "color", "border", "border-color", "border-width", "border-style", "border-radius", "box-shadow", "text-shadow", "font-family", "font-weight", "font-style", "letter-spacing", "text-align"];
var CSS_FONTS = ["arial", "georgia", "courier new", "monoton", "impact", "verdana", "trebuchet ms", "press start 2p", "monospace", "serif", "sans-serif"];
var CSS_FUNCS = ["rgb", "rgba", "hsl", "hsla", "linear-gradient", "radial-gradient"];
var STYLE_PRESETS = {
	plain: "",
	fire: "background: linear-gradient(135deg, #7a1c00, #ff7a18); color: #ffffff; border-color: #ffb347;",
	ocean: "background: linear-gradient(135deg, #003a66, #29b6f6); color: #ffffff; border-color: #b3e5fc;",
	neon: "background: #120024; color: #39ff14; border: 2px solid #39ff14; box-shadow: 0 0 12px #39ff14; font-family: Courier New;"
};

function safeCss(text){
	var out = [];
	var parts = String(text || "").substring(0, 400).split(";");
	for(var i = 0; i < parts.length && out.length < 16; i++){
		var k = parts[i].indexOf(":");
		if(k < 1)
			continue;
		var prop = parts[i].substring(0, k).trim().toLowerCase();
		var val = parts[i].substring(k + 1).trim();
		if(CSS_PROPS.indexOf(prop) < 0 || !val || val.length > 140)
			continue;
		if(!/^[A-Za-z0-9 #,.%()\-]+$/.test(val))
			continue;
		var lv = val.toLowerCase();
		var ok = true;
		var fn = lv.match(/[a-z-]+(?=\()/g) || [];
		for(var a = 0; a < fn.length; a++){
			if(CSS_FUNCS.indexOf(fn[a]) < 0)
				ok = false;
		}
		var nums = lv.match(/\d*\.?\d+(?=px|em|rem|vmin|vh|vw)/g) || [];
		for(var b = 0; b < nums.length; b++){
			if(Number(nums[b]) > 40)
				ok = false;
		}
		if(prop == "background-image" && !/^(linear|radial)-gradient\(/.test(lv))
			ok = false;
		if(prop == "font-family" && CSS_FONTS.indexOf(lv) < 0)
			ok = false;
		if(ok)
			out.push([prop, val]);
	}
	return out;
}

function applyProfileStyle(el, css){
	var old = el._ps || [];
	for(var i = 0; i < old.length; i++)
		el.style.removeProperty(old[i]);
	var rules = safeCss(css);
	el._ps = [];
	var customFont = false;
	for(var j = 0; j < rules.length; j++){
		el.style.setProperty(rules[j][0], rules[j][1]);
		el._ps.push(rules[j][0]);
		if(rules[j][0] == "font-family")
			customFont = true;
	}
	return customFont;
}

function myProfileUser(){
	var p = cloud.profile || {};
	return {id: cloud.user.uid, username: cloud.user.username, name: nameBox.value || p.name || "", bio: p.bio || "", style: p.style || "", color: color, sat: sat, light: light, face: faceData, side: sideData, admin: cloud.isAdmin, owner: cloud.isOwner, banned: false};
}

function closeAcct(){
	var el = document.getElementById("acct");
	if(el)
		el.parentNode.removeChild(el);
}

function gfxRows(){
	function seg(label, key, opts, cur){
		var h = "<div class='srow'><div class='slabel'>" + label + "</div><div class='sseg'>";
		for(var i = 0; i < opts.length; i++)
			h += "<div class='cfgbtn small" + (String(cur) == opts[i][0] ? " sel" : "") + "' data-act='gfx' data-key='" + key + "' data-val='" + opts[i][0] + "'>" + opts[i][1] + "</div>";
		return h + "</div></div>";
	}
	return seg("Quality", "quality", [["low", "Low"], ["medium", "Medium"], ["high", "High"]], gfx.quality)
		+ seg("FPS limit", "fps", [["0", "Off"], ["60", "60"], ["30", "30"]], gfx.fps)
		+ seg("Scenery", "scenery", [["true", "On"], ["false", "Off"]], gfx.scenery)
		+ seg("Car names", "names", [["true", "On"], ["false", "Off"]], gfx.names)
		+ seg("FPS counter", "showFps", [["false", "Off"], ["true", "On"]], gfx.showFps)
		+ seg("Previews", "previews", [["true", "Spin"], ["false", "Still"]], gfx.previews);
}

function renderAcct(msg){
	var el = document.getElementById("acct");
	if(!el)
		return;
	var loggedIn = !!(window.cloud && cloud.user);
	function tab(val, label){
		return "<div class='cfgbtn small" + (setTab == val ? " sel" : "") + "' data-act='stab' data-val='" + val + "'>" + label + "</div>";
	}
	var html = "<div class='modalbox title'><div class='modaltitle'>Settings</div><div id='authtabs'>" + tab("game", "Game") + tab("account", "Account") + tab("profile", "Profile") + "</div><div class='modalmsg' id='acctmsg'></div>";
	if(setTab == "game"){
		html += gfxRows() + "<div class='modalrow'><div class='cfgbtn small' data-act='aclose'>Close</div></div></div>";
	}else if(!loggedIn){
		html += "<div class='modalmsg'>Log in to use this tab.</div><div class='modalrow'><div class='cfgbtn small' data-act='slogin'>Log in</div><div class='cfgbtn small' data-act='aclose'>Close</div></div></div>";
	}else if(setTab == "account" && acctState == "delete"){
		html += "<div class='modalmsg'>This deletes your account, profile and tracks forever. Enter your login code to confirm.</div><input class='field' id='deletecode' placeholder='Login code' autocomplete='off' autocapitalize='characters'><div class='modalrow'><div class='cfgbtn small' data-act='dodelete'>Delete forever</div><div class='cfgbtn small' data-act='back'>Back</div></div></div>";
	}else if(setTab == "account"){
		html += "<div class='modalmsg' id='acctuser'></div><div class='modalmsg' id='renamenote'></div><input class='field' id='newname' maxlength='16' placeholder='New username' autocomplete='off' autocapitalize='off'><input class='field' id='renamecode' placeholder='Login code (to confirm)' autocomplete='off' autocapitalize='characters'><div class='modalrow'><div class='cfgbtn small' data-act='rename'>Change name</div></div><div class='modalrow'><div class='cfgbtn small' data-act='logout'>Log out</div><div class='cfgbtn small' data-act='askdelete'>Delete account</div><div class='cfgbtn small' data-act='aclose'>Close</div></div></div>";
	}else{
		html += "<input class='field' id='bioinput' maxlength='140' placeholder='Your bio' autocomplete='off'><textarea class='field' id='styleinput' maxlength='400' placeholder='Profile CSS, for example: background: #123456; color: #ffffff; border-color: gold;' spellcheck='false'></textarea><div class='modalrow'><div class='cfgbtn small' data-act='preset' data-val='plain'>Plain</div><div class='cfgbtn small' data-act='preset' data-val='fire'>Fire</div><div class='cfgbtn small' data-act='preset' data-val='ocean'>Ocean</div><div class='cfgbtn small' data-act='preset' data-val='neon'>Neon</div></div><div id='stylepreview'>Preview</div><div class='modalrow'><div class='cfgbtn small' data-act='saveprofile'>Save profile</div><div class='cfgbtn small' data-act='aclose'>Close</div></div></div>";
	}
	el.innerHTML = html;
	var m = document.getElementById("acctmsg");
	if(m)
		m.textContent = msg || "";
	var au = document.getElementById("acctuser");
	if(au)
		au.textContent = "Logged in as " + cloud.user.username;
	var rn = document.getElementById("renamenote");
	if(rn){
		var left = cloud.renamedAt + 604800000 - Date.now();
		rn.textContent = cloud.isOwner ? "The owner name cannot be changed." : left > 0 ? "You can change your name again in " + Math.ceil(left / 86400000) + " day(s)." : "You can change your name once every 7 days.";
	}
	var bi = document.getElementById("bioinput");
	if(bi){
		bi.value = draft.bio != null ? draft.bio : (cloud.profile && cloud.profile.bio ? cloud.profile.bio : "");
		var si = document.getElementById("styleinput");
		si.value = draft.style != null ? draft.style : (cloud.profile && cloud.profile.style ? cloud.profile.style : "");
		applyProfileStyle(document.getElementById("stylepreview"), si.value);
	}
	var nn = document.getElementById("newname");
	if(nn && draft.newname != null)
		nn.value = draft.newname;
}

function acctInput(e){
	var id = e.target.id;
	if(id == "bioinput")
		draft.bio = e.target.value;
	else if(id == "styleinput"){
		draft.style = e.target.value;
		applyProfileStyle(document.getElementById("stylepreview"), e.target.value);
	}else if(id == "newname")
		draft.newname = e.target.value;
}

function acctClick(e){
	var t = e.target;
	var act = t.getAttribute ? t.getAttribute("data-act") : null;
	if(t.id == "acct" || act == "aclose"){
		closeAcct();
	}else if(act == "stab"){
		setTab = t.getAttribute("data-val") == "account" ? "account" : t.getAttribute("data-val") == "profile" ? "profile" : "game";
		acctState = "main";
		renderAcct("");
	}else if(act == "gfx"){
		var key = t.getAttribute("data-key");
		var val = t.getAttribute("data-val");
		if(key == "quality")
			gfx.quality = ["low", "medium", "high"].indexOf(val) >= 0 ? val : "high";
		else if(key == "fps")
			gfx.fps = [0, 30, 60].indexOf(Number(val)) >= 0 ? Number(val) : 0;
		else if(["scenery", "names", "showFps", "previews"].indexOf(key) >= 0)
			gfx[key] = val == "true";
		saveGfx();
		if(typeof applyGfx == "function")
			applyGfx();
		renderAcct("");
	}else if(act == "slogin"){
		closeAcct();
		openAuth("login", "");
	}else if(act == "preset"){
		var si = document.getElementById("styleinput");
		si.value = STYLE_PRESETS[t.getAttribute("data-val")] || "";
		draft.style = si.value;
		applyProfileStyle(document.getElementById("stylepreview"), si.value);
	}else if(act == "saveprofile"){
		var bio = document.getElementById("bioinput").value.trim().substring(0, 140);
		var css = document.getElementById("styleinput").value.replace(/[^A-Za-z0-9 #,.:;%()\n\-]/g, "").substring(0, 400);
		cloud.saveProfile({bio: bio, style: css}).then(function(){
			if(cloud.profile){
				cloud.profile.bio = bio;
				cloud.profile.style = css;
			}
			draft.bio = null;
			draft.style = null;
			renderAcct("Saved.");
		}).catch(function(err){
			renderAcct(err.message);
		});
	}else if(act == "rename"){
		var nm = document.getElementById("newname").value;
		draft.newname = nm;
		cloud.rename(nm, document.getElementById("renamecode").value).then(function(n){
			draft.newname = null;
			renderAccount();
			renderAcct("Your name is now " + n + ".");
		}).catch(function(err){
			renderAcct(err.message);
		});
	}else if(act == "logout"){
		closeAcct();
		cloud.logout();
	}else if(act == "askdelete"){
		acctState = "delete";
		renderAcct("");
	}else if(act == "back"){
		acctState = "main";
		renderAcct("");
	}else if(act == "dodelete"){
		cloud.deleteAccount(document.getElementById("deletecode").value).then(function(){
			closeAcct();
		}).catch(function(err){
			renderAcct(err.message);
		});
	}
}

function openSettingsModal(tab){
	closeAcct();
	setTab = tab == "account" || tab == "profile" ? tab : "game";
	acctState = "main";
	draft = {};
	var el = document.createElement("DIV");
	el.id = "acct";
	el.className = "overlay";
	el.addEventListener("click", acctClick);
	el.addEventListener("input", acctInput);
	f.appendChild(el);
	renderAcct("");
}

function closeAdmin(){
	var el = document.getElementById("admin");
	if(el)
		el.parentNode.removeChild(el);
}

function adminMsg(t){
	var m = document.getElementById("adminmsg");
	if(m)
		m.textContent = t;
}

function renderAdminList(){
	var box = document.getElementById("adminlist");
	var filter = document.getElementById("adminfilter");
	if(!box)
		return;
	var q = filter ? filter.value.trim().toLowerCase() : "";
	box.innerHTML = "";
	if(adminTab == "tracks"){
		for(var t = 0; t < adminTracks.length; t++){
			var tr = adminTracks[t];
			if(q && (tr.name + " " + tr.ownerName).toLowerCase().indexOf(q) < 0)
				continue;
			var tb = [];
			if(tr.public)
				tb.push(["Unshare", "atunshare", t]);
			tb.push(["Delete", "atdel", t]);
			box.appendChild(rowFor({b: textEl("B", tr.name), span: textEl("SPAN", "by " + tr.ownerName + (tr.public ? " [shared]" : " [private]"))}, tb));
		}
		return;
	}
	for(var i = 0; i < adminList.length; i++){
		var u = adminList[i];
		if(q && u.username.toLowerCase().indexOf(q) < 0)
			continue;
		var buttons = [];
		var mineRow = cloud.user && u.id == cloud.user.uid;
		if(!u.owner && !mineRow){
			var canAct = cloud.isOwner || !u.admin;
			if(canAct)
				buttons.push([u.banned ? "Unban" : "Ban", u.banned ? "aunban" : "aban", i]);
			if(cloud.isOwner)
				buttons.push([u.admin ? "Unadmin" : "Admin", u.admin ? "aunadmin" : "agive", i]);
			if(canAct){
				buttons.push(["Clear", "aclear", i]);
				buttons.push(["Delete", "adel", i]);
			}
		}
		box.appendChild(rowFor({b: textEl("B", u.username), span: textEl("SPAN", userTags(u).trim())}, buttons));
	}
}

function adminStats(){
	var admins = 0, banned = 0;
	for(var i = 0; i < adminList.length; i++){
		if(adminList[i].admin)
			admins++;
		if(adminList[i].banned)
			banned++;
	}
	return adminList.length + " users, " + admins + " admins, " + banned + " banned";
}

function renderAdmin(){
	var el = document.getElementById("admin");
	if(!el)
		return;
	function tab(val, label){
		return "<div class='cfgbtn small" + (adminTab == val ? " sel" : "") + "' data-act='adtab' data-val='" + val + "'>" + label + "</div>";
	}
	var html = "<div class='modalbox title'><div class='modaltitle'>Admin</div><div id='authtabs'>" + tab("users", "Users") + tab("tracks", "Tracks") + tab("banner", "Banner") + "</div><div class='modalmsg' id='adminmsg'></div>";
	if(adminTab == "banner"){
		html += "<textarea class='field' id='bannertext' maxlength='200' placeholder='Banner message shown on the site and in games' spellcheck='false'></textarea><div class='modalrow'><div class='cfgbtn small" + (bannerDraft.kind == "info" ? " sel" : "") + "' data-act='bkind' data-val='info'>Info</div><div class='cfgbtn small" + (bannerDraft.kind == "warn" ? " sel" : "") + "' data-act='bkind' data-val='warn'>Warning</div><div class='cfgbtn small" + (bannerDraft.kind == "alert" ? " sel" : "") + "' data-act='bkind' data-val='alert'>Alert</div><div class='cfgbtn small" + (bannerDraft.enabled ? " sel" : "") + "' data-act='bon'>" + (bannerDraft.enabled ? "Shown" : "Hidden") + "</div></div><div class='modalrow'><div class='cfgbtn small' data-act='bsave'>Save banner</div><div class='cfgbtn small' data-act='bremove'>Remove</div><div class='cfgbtn small' data-act='adclose'>Close</div></div></div>";
	}else{
		html += "<input class='field' id='adminfilter' placeholder='" + (adminTab == "tracks" ? "Search tracks" : "Search users") + "' autocomplete='off'><div id='adminlist'></div><div class='modalrow'><div class='cfgbtn small' data-act='adclose'>Close</div></div></div>";
	}
	el.innerHTML = html;
	var bt = document.getElementById("bannertext");
	if(bt)
		bt.value = bannerDraft.text;
	var af = document.getElementById("adminfilter");
	if(af)
		af.addEventListener("input", renderAdminList);
}

function loadAdminTab(){
	if(adminTab == "banner"){
		adminMsg(cloud.banner ? "Showing now: " + cloud.banner.text : "No banner is showing.");
		return;
	}
	adminMsg("Loading...");
	var tab = adminTab;
	var p = tab == "tracks" ? cloud.allTracks() : cloud.users();
	p.then(function(list){
		if(tab != adminTab)
			return;
		if(tab == "tracks")
			adminTracks = list;
		else
			adminList = list;
		adminMsg(tab == "users" ? adminStats() : list.length + " tracks");
		renderAdminList();
	}).catch(function(err){
		adminMsg(err.message);
	});
}

function adminClick(e){
	var t = e.target;
	var act = t.getAttribute ? t.getAttribute("data-act") : null;
	var idx = Number(t.getAttribute ? t.getAttribute("data-i") : -1);
	var u = adminList[idx];
	var tr = adminTracks[idx];
	function done(p, after){
		p.then(function(){
			after();
			adminMsg(adminTab == "users" ? adminStats() : adminTracks.length + " tracks");
			renderAdminList();
		}).catch(function(err){
			adminMsg(err.message);
		});
	}
	if(t.id == "admin" || act == "adclose"){
		closeAdmin();
	}else if(act == "adtab"){
		var v = t.getAttribute("data-val");
		adminTab = v == "tracks" ? "tracks" : v == "banner" ? "banner" : "users";
		if(adminTab == "banner")
			bannerDraft = cloud.banner ? {text: cloud.banner.text, kind: cloud.banner.kind, enabled: true} : {text: "", kind: "info", enabled: true};
		renderAdmin();
		loadAdminTab();
	}else if(act == "bkind"){
		bannerDraft.text = document.getElementById("bannertext").value;
		bannerDraft.kind = t.getAttribute("data-val");
		renderAdmin();
	}else if(act == "bon"){
		bannerDraft.text = document.getElementById("bannertext").value;
		bannerDraft.enabled = !bannerDraft.enabled;
		renderAdmin();
	}else if(act == "bsave"){
		bannerDraft.text = document.getElementById("bannertext").value;
		cloud.setBanner(bannerDraft).then(function(){
			adminMsg("Banner saved.");
		}).catch(function(err){
			adminMsg(err.message);
		});
	}else if(act == "bremove"){
		cloud.setBanner({text: "", kind: bannerDraft.kind, enabled: false}).then(function(){
			bannerDraft.text = "";
			renderAdmin();
			adminMsg("Banner removed.");
		}).catch(function(err){
			adminMsg(err.message);
		});
	}else if(act == "atunshare" && tr){
		done(cloud.setPublic(tr.id, false), function(){
			tr.public = false;
		});
	}else if(act == "atdel" && tr){
		if(confirm("Delete the track " + tr.name + "?"))
			done(cloud.deleteTrack(tr.id), function(){
				adminTracks.splice(adminTracks.indexOf(tr), 1);
			});
	}else if(!u){
		return;
	}else if(act == "aban"){
		if(confirm("Ban " + u.username + "?"))
			done(cloud.setBanned(u.id, true), function(){
				u.banned = true;
			});
	}else if(act == "aunban"){
		done(cloud.setBanned(u.id, false), function(){
			u.banned = false;
		});
	}else if(act == "agive"){
		if(confirm("Make " + u.username + " an admin?"))
			done(cloud.setAdmin(u.id, true), function(){
				u.admin = true;
			});
	}else if(act == "aunadmin"){
		if(confirm("Remove admin from " + u.username + "?"))
			done(cloud.setAdmin(u.id, false), function(){
				u.admin = false;
			});
	}else if(act == "aclear"){
		if(confirm("Clear the bio, style, face and sides of " + u.username + "?"))
			done(cloud.clearProfile(u.id), function(){
				u.bio = "";
				u.style = "";
				u.face = null;
				u.side = null;
			});
	}else if(act == "adel"){
		if(confirm("Delete the account " + u.username + "? Their profile and tracks are wiped."))
			done(cloud.adminDelete(u.id), function(){
				adminList.splice(adminList.indexOf(u), 1);
			});
	}
}

function openAdmin(){
	if(!window.cloud || !cloud.user || !cloud.isAdmin)
		return;
	closeAdmin();
	adminTab = "users";
	var el = document.createElement("DIV");
	el.id = "admin";
	el.className = "overlay";
	el.addEventListener("click", adminClick);
	f.appendChild(el);
	renderAdmin();
	loadAdminTab();
}

function renderBanner(b){
	var el = document.getElementById("banner");
	if(!el)
		return;
	if(b){
		el.textContent = b.text;
		el.className = "show " + b.kind;
		document.body.classList.add("hasBanner");
	}else{
		el.textContent = "";
		el.className = "";
		document.body.classList.remove("hasBanner");
	}
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

if(window.cloud){
	if(cloud.onBanner)
		cloud.onBanner(renderBanner);
	cloud.onChange(function(user, profile){
		renderAccount();
		if(!user && cloud.notice){
			var note = cloud.notice;
			cloud.notice = "";
			openAuth("login", note);
		}
		if(!user){
			closeAcct();
			closeAdmin();
		}
		if(user && profile)
			applyCloudProfile(profile);
		else if(user)
			cloud.saveProfile(localProfile()).catch(function(){});
	});
}
