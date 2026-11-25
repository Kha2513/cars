(function(){
	var cloud = window.cloud = {enabled: false, ready: false, user: null, profile: null, isAdmin: false, isOwner: false, notice: "", renamedAt: 0, banner: null, listeners: [], bannerListeners: []};
	var OWNER = "kha2513";
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

	cloud.onBanner = function(fn){
		cloud.bannerListeners.push(fn);
		fn(cloud.banner);
	};

	function emitBanner(){
		for(var i = 0; i < cloud.bannerListeners.length; i++)
			cloud.bannerListeners[i](cloud.banner);
	}

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
		if(typeof p.bio == "string")
			out.bio = p.bio.substring(0, 140);
		if(typeof p.style == "string")
			out.style = p.style.replace(/[^A-Za-z0-9 #,.:;%()\n\-]/g, "").substring(0, 400);
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
				cloud.isOwner = n.toLowerCase() == OWNER;
				cloud.isAdmin = cloud.isOwner;
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

	function userOf(snap){
		var d = snap.data();
		return {id: snap.id, username: d.username, name: d.name || "", bio: d.bio || "", style: d.style || "", color: d.color, sat: d.sat, light: d.light, face: d.face || null, side: d.side || null, admin: d.admin === true || d.usernameLower == OWNER, owner: d.usernameLower == OWNER, banned: d.banned === true, deleted: d.deleted === true};
	}

	cloud.users = function(){
		return db.collection("users").limit(300).get().then(function(q){
			var out = [];
			q.forEach(function(s){
				var u = userOf(s);
				if(!u.deleted && u.username)
					out.push(u);
			});
			return out.sort(function(a, b){
				return a.username.toLowerCase() < b.username.toLowerCase() ? -1 : 1;
			});
		}).catch(fail);
	};

	cloud.userTracks = function(uid){
		return db.collection("tracks").where("ownerId", "==", uid).where("public", "==", true).get().then(function(q){
			var out = [];
			q.forEach(function(s){
				out.push(trackOf(s));
			});
			return newestFirst(out);
		}).catch(fail);
	};

	cloud.setAdmin = function(uid, on){
		return db.collection("users").doc(uid).set({admin: !!on, updated: stamp()}, {merge: true}).catch(fail);
	};

	cloud.clearProfile = function(uid){
		return db.collection("users").doc(uid).set({bio: "", style: "", face: null, side: null, updated: stamp()}, {merge: true}).catch(fail);
	};

	cloud.allTracks = function(){
		return db.collection("tracks").limit(200).get().then(function(q){
			var out = [];
			q.forEach(function(s){
				out.push(trackOf(s));
			});
			return newestFirst(out);
		}).catch(fail);
	};

	cloud.setBanner = function(b){
		var text = String(b && b.text != null ? b.text : "").trim().substring(0, 200);
		var kind = b && (b.kind == "warn" || b.kind == "alert") ? b.kind : "info";
		if(!cloud.user)
			return Promise.reject(new Error("Log in first."));
		return db.collection("config").doc("banner").set({text: text, kind: kind, enabled: !!(b && b.enabled) && text.length > 0, by: cloud.user.username, updated: stamp()}).catch(fail);
	};

	cloud.rename = function(newName, code){
		var n = cleanName(newName);
		if(!n)
			return Promise.reject(new Error("Usernames are 3 to 16 letters, numbers or underscores."));
		if(!cloud.user || !auth.currentUser)
			return Promise.reject(new Error("Log in first."));
		if(cloud.isOwner || n.toLowerCase() == OWNER)
			return Promise.reject(new Error("That name is reserved."));
		var left = cloud.renamedAt + 604800000 - Date.now();
		if(left > 0)
			return Promise.reject(new Error("You can change your name again in " + Math.ceil(left / 86400000) + " day(s)."));
		var old = cloud.user.username;
		if(n == old)
			return Promise.reject(new Error("That is already your name."));
		var u = auth.currentUser;
		var oldEmail = u.email;
		var newEmail = n.toLowerCase() + EMAIL_DOMAIN;
		var emailChanged = false;
		var cred = firebase.auth.EmailAuthProvider.credential(oldEmail, normCode(code));
		return u.reauthenticateWithCredential(cred).then(function(){
			if(newEmail == oldEmail)
				return null;
			return u.updateEmail(newEmail).then(function(){
				emailChanged = true;
			});
		}).then(function(){
			var doc = {username: n, usernameLower: n.toLowerCase(), renamedAt: stamp(), updated: stamp()};
			if(cloud.profile && cloud.profile.name && cloud.profile.name.toLowerCase() == old.toLowerCase())
				doc.name = n;
			return db.collection("users").doc(u.uid).set(doc, {merge: true}).catch(function(e){
				if(emailChanged)
					return u.updateEmail(oldEmail).then(function(){
						throw e;
					}, function(){
						throw e;
					});
				throw e;
			});
		}).then(function(){
			return db.collection("tracks").where("ownerId", "==", u.uid).get();
		}).then(function(q){
			var batch = db.batch();
			q.forEach(function(s){
				batch.set(s.ref, {ownerName: n, updated: stamp()}, {merge: true});
			});
			return batch.commit();
		}).then(function(){
			cloud.user = {uid: u.uid, username: n};
			cloud.renamedAt = Date.now();
			if(cloud.profile && cloud.profile.name && cloud.profile.name.toLowerCase() == old.toLowerCase())
				cloud.profile.name = n;
			emit();
			return n;
		}).catch(fail);
	};

	cloud.setBanned = function(uid, banned){
		return db.collection("users").doc(uid).set({banned: !!banned, updated: stamp()}, {merge: true}).catch(fail);
	};

	cloud.giveAdmin = function(uid){
		return db.collection("users").doc(uid).set({admin: true, updated: stamp()}, {merge: true}).catch(fail);
	};

	cloud.adminDelete = function(uid){
		return db.collection("tracks").where("ownerId", "==", uid).get().then(function(q){
			var batch = db.batch();
			q.forEach(function(s){
				batch.delete(s.ref);
			});
			batch.set(db.collection("users").doc(uid), {deleted: true, banned: false, name: "", bio: "", face: null, side: null, updated: stamp()}, {merge: true});
			return batch.commit();
		}).catch(fail);
	};

	cloud.deleteAccount = function(code){
		var u = auth.currentUser;
		if(!u)
			return Promise.reject(new Error("Log in first."));
		var cred = firebase.auth.EmailAuthProvider.credential(u.email, normCode(code));
		return u.reauthenticateWithCredential(cred).then(function(){
			return db.collection("tracks").where("ownerId", "==", u.uid).get();
		}).then(function(q){
			var batch = db.batch();
			q.forEach(function(s){
				batch.delete(s.ref);
			});
			batch.delete(db.collection("users").doc(u.uid));
			return batch.commit();
		}).then(function(){
			registering = true;
			return u.delete();
		}).then(function(){
			registering = false;
			cloud.user = null;
			cloud.profile = null;
			cloud.isAdmin = false;
			cloud.isOwner = false;
			emit();
		}).catch(function(e){
			registering = false;
			return fail(e);
		});
	};

	cloud.adminProof = function(host){
		if(!cloud.user || !cloud.isAdmin)
			return Promise.resolve(null);
		return db.collection("sessions").add({uid: cloud.user.uid, host: String(host), created: stamp(), expires: firebase.firestore.Timestamp.fromMillis(Date.now() + 43200000)}).then(function(ref){
			return {sid: ref.id, uid: cloud.user.uid};
		}).catch(function(){
			return null;
		});
	};

	cloud.verifyAdmin = function(proof, host){
		if(!proof || typeof proof.sid != "string" || typeof proof.uid != "string")
			return Promise.resolve(false);
		return db.collection("sessions").doc(proof.sid).get().then(function(s){
			if(!s.exists)
				return false;
			var d = s.data();
			var exp = d.expires && d.expires.toMillis ? d.expires.toMillis() : 0;
			if(d.uid !== proof.uid || d.host !== host || exp < Date.now())
				return false;
			return db.collection("users").doc(proof.uid).get().then(function(u){
				if(!u.exists)
					return false;
				var x = u.data();
				return x.banned !== true && x.deleted !== true && (x.admin === true || x.usernameLower == OWNER);
			});
		}).catch(function(){
			return false;
		});
	};

	db.collection("config").doc("banner").onSnapshot(function(snap){
		var d = snap.exists ? snap.data() : null;
		cloud.banner = d && d.enabled === true && typeof d.text == "string" && d.text ? {text: d.text.substring(0, 200), kind: d.kind == "warn" || d.kind == "alert" ? d.kind : "info", by: d.by || ""} : null;
		emitBanner();
	}, function(){});

	auth.onAuthStateChanged(function(user){
		if(registering)
			return;
		if(!user){
			cloud.user = null;
			cloud.profile = null;
			cloud.isAdmin = false;
			cloud.isOwner = false;
			cloud.ready = true;
			emit();
			return;
		}
		var fallback = user.email ? user.email.split("@")[0] : "player";
		function finish(){
			cloud.ready = true;
			emit();
		}
		db.collection("users").doc(user.uid).get().then(function(snap){
			var d = snap.exists ? snap.data() : null;
			if(d && (d.banned === true || d.deleted === true)){
				cloud.notice = d.deleted === true ? "This account was deleted." : "This account is banned.";
				return auth.signOut();
			}
			if(d){
				cloud.user = {uid: user.uid, username: d.username || fallback};
				cloud.profile = cleanProfile(d);
				cloud.isOwner = d.usernameLower == OWNER;
				cloud.isAdmin = d.admin === true || cloud.isOwner;
				cloud.renamedAt = d.renamedAt && d.renamedAt.toMillis ? d.renamedAt.toMillis() : 0;
			}else{
				cloud.user = {uid: user.uid, username: fallback};
				cloud.profile = null;
				cloud.isOwner = false;
				cloud.isAdmin = false;
			}
			finish();
		}).catch(function(){
			cloud.user = {uid: user.uid, username: fallback};
			cloud.profile = null;
			finish();
		});
	});
})();
