(function(){
	var cloud = window.cloud = {enabled: false, ready: false, user: null, profile: null, listeners: []};
	var EMAIL_DOMAIN = "@cars.invalid";
	var ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

	function emit(){
		for(var i = 0; i < cloud.listeners.length; i++)
			cloud.listeners[i](cloud.user, cloud.profile);
	}

	cloud.onChange = function(fn){
		cloud.listeners.push(fn);
		if(cloud.ready)
			fn(cloud.user, cloud.profile);
	};

	cloud.cleanTrack = function(v){
		var t = String(v == null ? "" : v).replace(/<br\s*\/?>/gi, "").trim();
		var parts = t.split("|");
		if(parts.length < 4)
			return null;
		t = parts.slice(0, 4).join("|") + "|";
		return t.length < 60000 && /^[0-9 ,\/|.\-]*$/.test(t) ? t : null;
	};

	function cleanName(n){
		n = String(n == null ? "" : n).trim();
		return /^[A-Za-z0-9_]{3,16}$/.test(n) ? n : null;
	}

	function normCode(c){
		return String(c == null ? "" : c).toUpperCase().replace(/[^A-Z0-9]/g, "");
	}

	function fmtCode(raw){
		return raw.match(/.{1,4}/g).join("-");
	}

	function newCode(){
		var out = "";
		var limit = 256 - 256 % ALPHABET.length;
		while(out.length < 20){
			var bytes = new Uint8Array(32);
			crypto.getRandomValues(bytes);
			for(var i = 0; i < bytes.length && out.length < 20; i++){
				if(bytes[i] < limit)
					out += ALPHABET[bytes[i] % ALPHABET.length];
			}
		}
		return out;
	}

	cloud.formatCode = fmtCode;
	cloud.normCode = normCode;

	var cfg = window.FIREBASE_CONFIG;
	if(!cfg || !cfg.apiKey || cfg.apiKey.indexOf("YOUR_") === 0 || !window.firebase){
		cloud.ready = true;
		return;
	}

	firebase.initializeApp(cfg);
	var auth = firebase.auth();
	var db = firebase.firestore();
	var stamp = function(){
		return firebase.firestore.FieldValue.serverTimestamp();
	};
	var registering = false;
	cloud.enabled = true;

	function fail(e){
		var c = e && e.code ? e.code : "";
		var m = e && e.message ? e.message : "Something went wrong.";
		if(c == "auth/email-already-in-use")
			m = "That username is taken.";
		else if(c == "auth/invalid-credential" || c == "auth/wrong-password" || c == "auth/user-not-found" || c == "auth/invalid-login-credentials" || c == "auth/invalid-email")
			m = "Wrong username or code.";
		else if(c == "auth/too-many-requests")
			m = "Too many tries. Wait a bit and try again.";
		else if(c == "auth/network-request-failed")
			m = "No connection.";
		else if(c == "auth/operation-not-allowed")
			m = "Turn on Email/Password sign-in in Firebase.";
		else if(c == "permission-denied")
			m = "Not allowed. Check the Firestore rules.";
		return Promise.reject(new Error(m));
	}

	function cleanProfile(p){
		p = p || {};
		var out = {};
		if(typeof p.name == "string")
			out.name = p.name.substring(0, 50);
		if(isFinite(p.color))
			out.color = Math.min(360, Math.max(0, Math.round(p.color)));
		if(isFinite(p.sat))
			out.sat = Math.min(100, Math.max(0, Math.round(p.sat)));
		if(isFinite(p.light))
			out.light = Math.min(100, Math.max(0, Math.round(p.light)));
		var keys = ["face", "side"];
		for(var i = 0; i < keys.length; i++){
			var v = p[keys[i]];
			if(v === null)
				out[keys[i]] = null;
			else if(typeof v == "string" && v.indexOf("data:image/png;base64,") === 0 && v.length < 20000)
				out[keys[i]] = v;
		}
		return out;
	}

	cloud.register = function(username, profile){
		var n = cleanName(username);
		if(!n)
			return Promise.reject(new Error("Usernames are 3 to 16 letters, numbers or underscores."));
		var raw = newCode();
		registering = true;
		return auth.createUserWithEmailAndPassword(n.toLowerCase() + EMAIL_DOMAIN, raw).then(function(cred){
			var doc = cleanProfile(profile);
			doc.username = n;
			doc.usernameLower = n.toLowerCase();
			if(!doc.name)
				doc.name = n;
			doc.created = stamp();
			doc.updated = stamp();
			return db.collection("users").doc(cred.user.uid).set(doc).then(function(){
				cloud.user = {uid: cred.user.uid, username: n};
				cloud.profile = cleanProfile(doc);
				cloud.ready = true;
				registering = false;
				emit();
				return {username: n, code: fmtCode(raw)};
			});
		}).catch(function(e){
			registering = false;
			return fail(e);
		});
	};

	cloud.login = function(username, code){
		var n = cleanName(username);
		if(!n)
			return Promise.reject(new Error("Wrong username or code."));
		return auth.signInWithEmailAndPassword(n.toLowerCase() + EMAIL_DOMAIN, normCode(code)).then(function(){
			return null;
		}).catch(fail);
	};

	cloud.logout = function(){
		return auth.signOut();
	};

	cloud.saveProfile = function(p){
		if(!cloud.user)
			return Promise.resolve();
		var doc = cleanProfile(p);
		doc.updated = stamp();
		return db.collection("users").doc(cloud.user.uid).set(doc, {merge: true}).catch(fail);
	};

	function trackOf(snap){
		var d = snap.data();
		var u = d.updated && d.updated.toMillis ? d.updated.toMillis() : 0;
		return {id: snap.id, name: d.name, ownerId: d.ownerId, ownerName: d.ownerName, data: d.data, public: !!d.public, updated: u};
	}

	function newestFirst(list){
		return list.sort(function(a, b){
			return b.updated - a.updated;
		});
	}

	cloud.saveTrack = function(t){
		if(!cloud.user)
			return Promise.reject(new Error("Log in first."));
		var data = cloud.cleanTrack(t.data);
		var name = String(t.name == null ? "" : t.name).trim().substring(0, 40);
		if(!data)
			return Promise.reject(new Error("That track has bad data."));
		if(!name)
			return Promise.reject(new Error("Give the track a name."));
		var doc = {ownerId: cloud.user.uid, ownerName: cloud.user.username, name: name, data: data, public: !!t.public, updated: stamp()};
		if(t.id)
			return db.collection("tracks").doc(t.id).set(doc, {merge: true}).then(function(){
				return t.id;
			}).catch(fail);
		doc.created = stamp();
		return db.collection("tracks").add(doc).then(function(ref){
			return ref.id;
		}).catch(fail);
	};

	cloud.myTracks = function(){
		if(!cloud.user)
			return Promise.resolve([]);
		return db.collection("tracks").where("ownerId", "==", cloud.user.uid).get().then(function(q){
			var out = [];
			q.forEach(function(s){
				out.push(trackOf(s));
			});
			return newestFirst(out);
		}).catch(fail);
	};

	cloud.publicTracks = function(){
		return db.collection("tracks").where("public", "==", true).limit(60).get().then(function(q){
			var out = [];
			q.forEach(function(s){
				out.push(trackOf(s));
			});
			return newestFirst(out);
		}).catch(fail);
	};

	cloud.setPublic = function(id, pub){
		return db.collection("tracks").doc(id).set({public: !!pub, updated: stamp()}, {merge: true}).catch(fail);
	};

	cloud.deleteTrack = function(id){
		return db.collection("tracks").doc(id).delete().catch(fail);
	};

	auth.onAuthStateChanged(function(user){
		if(registering)
			return;
		if(!user){
			cloud.user = null;
			cloud.profile = null;
			cloud.ready = true;
			emit();
			return;
		}
		var fallback = user.email ? user.email.split("@")[0] : "player";
		db.collection("users").doc(user.uid).get().then(function(snap){
			if(snap.exists){
				cloud.user = {uid: user.uid, username: snap.data().username || fallback};
				cloud.profile = cleanProfile(snap.data());
			}else{
				cloud.user = {uid: user.uid, username: fallback};
				cloud.profile = null;
			}
		}).catch(function(){
			cloud.user = {uid: user.uid, username: fallback};
			cloud.profile = null;
		}).then(function(){
			cloud.ready = true;
			emit();
		});
	});
})();
