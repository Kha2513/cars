(function(){
	var gate = document.getElementById("gate");
	var gateText = document.getElementById("gatetext");
	var panel = document.getElementById("cloudpanel");
	var curId = null, tab = "mine", items = [], busy = false;

	function say(m){
		var el = document.getElementById("cmsg");
		if(el)
			el.textContent = m;
	}

	function checkGate(){
		if(!window.cloud.enabled){
			gate.className = "";
			gateText.textContent = "Accounts are not set up yet.";
		}else if(!window.cloud.ready){
			gate.className = "";
			gateText.textContent = "Checking login...";
		}else if(!window.cloud.user){
			gate.className = "";
			gateText.textContent = "Log in on the main page to use the editor.";
		}else{
			gate.className = "open";
		}
	}

	window.cloud.onChange(function(){
		checkGate();
		if(!window.cloud.user)
			closeCloud();
	});
	checkGate();

	function closeCloud(){
		panel.className = "";
		panel.innerHTML = "";
	}

	function render(){
		var nameEl = document.getElementById("tname");
		var keepName = nameEl ? nameEl.value : "";
		var keepPub = document.getElementById("tpublic") ? document.getElementById("tpublic").checked : false;
		panel.innerHTML = "<div id='cloudbox'><h2>Cloud tracks</h2><div class='crow'><input type='text' id='tname' maxlength='40' placeholder='Track name'><label><input type='checkbox' id='tpublic'> Share</label><div class='cbtn' data-act='save'>" + (curId ? "Update" : "Save") + "</div>" + (curId ? "<div class='cbtn' data-act='new'>Save as new</div>" : "") + "</div><div id='cmsg'></div><div class='crow'><div class='cbtn" + (tab == "mine" ? " sel" : "") + "' data-act='tab' data-val='mine'>My tracks</div><div class='cbtn" + (tab == "shared" ? " sel" : "") + "' data-act='tab' data-val='shared'>Shared tracks</div></div><div id='clist'></div><div class='crow' style='justify-content:center'><div class='cbtn' data-act='close'>Close</div></div></div>";
		document.getElementById("tname").value = keepName;
		document.getElementById("tpublic").checked = keepPub;
	}

	function fill(list){
		items = list;
		var box = document.getElementById("clist");
		if(!box)
			return;
		box.innerHTML = "";
		if(!list.length)
			say(tab == "mine" ? "You have no saved tracks yet." : "Nothing is shared yet.");
		for(var i = 0; i < list.length; i++){
			var row = document.createElement("DIV");
			row.className = "ctrack";
			var info = document.createElement("DIV");
			info.className = "cinfo";
			var b = document.createElement("B");
			b.textContent = list[i].name;
			var by = document.createElement("SPAN");
			by.textContent = (tab == "mine" ? (list[i].public ? "shared" : "private") : "by " + list[i].ownerName);
			info.appendChild(b);
			info.appendChild(by);
			row.appendChild(info);
			var load = document.createElement("DIV");
			load.className = "cbtn";
			load.textContent = "Load";
			load.setAttribute("data-act", "load");
			load.setAttribute("data-i", i);
			row.appendChild(load);
			if(tab == "mine"){
				var pub = document.createElement("DIV");
				pub.className = "cbtn";
				pub.textContent = list[i].public ? "Unshare" : "Share";
				pub.setAttribute("data-act", "pub");
				pub.setAttribute("data-i", i);
				row.appendChild(pub);
				var del = document.createElement("DIV");
				del.className = "cbtn";
				del.textContent = "Delete";
				del.setAttribute("data-act", "del");
				del.setAttribute("data-i", i);
				row.appendChild(del);
			}
			box.appendChild(row);
		}
	}

	function refresh(){
		say("Loading...");
		var t = tab;
		var p = t == "mine" ? window.cloud.myTracks() : window.cloud.publicTracks();
		p.then(function(list){
			if(t != tab)
				return;
			say("");
			fill(list);
		}).catch(function(e){
			say(e.message);
		});
	}

	function save(asNew){
		if(busy)
			return;
		var data = trackText();
		if(!walls.length && !start.length && !trees.length && !arrows.length){
			say("Nothing to save yet.");
			return;
		}
		busy = true;
		say("Saving...");
		window.cloud.saveTrack({
			id: asNew ? null : curId,
			name: document.getElementById("tname").value,
			data: data,
			public: document.getElementById("tpublic").checked
		}).then(function(id){
			busy = false;
			curId = id;
			render();
			refresh();
			say("Saved.");
		}).catch(function(e){
			busy = false;
			say(e.message);
		});
	}

	function onClick(e){
		var t = e.target;
		var act = t.getAttribute ? t.getAttribute("data-act") : null;
		var item = items[Number(t.getAttribute ? t.getAttribute("data-i") : -1)];
		if(t === panel || act == "close"){
			closeCloud();
		}else if(act == "save"){
			save(false);
		}else if(act == "new"){
			save(true);
		}else if(act == "tab"){
			tab = t.getAttribute("data-val") == "shared" ? "shared" : "mine";
			render();
			refresh();
		}else if(act == "load" && item){
			var clean = window.cloud.cleanTrack(item.data);
			if(!clean){
				say("That track has bad data.");
				return;
			}
			loadTrack(clean);
			curId = item.ownerId == window.cloud.user.uid ? item.id : null;
			render();
			document.getElementById("tname").value = item.name;
			document.getElementById("tpublic").checked = item.public && curId !== null;
			refresh();
			say("Loaded " + item.name + ".");
		}else if(act == "pub" && item){
			window.cloud.setPublic(item.id, !item.public).then(refresh).catch(function(err){
				say(err.message);
			});
		}else if(act == "del" && item){
			if(!confirm("Delete " + item.name + "?"))
				return;
			window.cloud.deleteTrack(item.id).then(function(){
				if(curId == item.id)
					curId = null;
				render();
				refresh();
			}).catch(function(err){
				say(err.message);
			});
		}
	}

	panel.addEventListener("click", onClick);

	window.openCloud = function(){
		if(!window.cloud.user)
			return;
		panel.className = "open";
		render();
		refresh();
	};
})();
