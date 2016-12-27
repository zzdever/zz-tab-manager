/*
*
* Copyright 2015-2016 zzdever
*
* Author: zzdever
* MailTo: zzdever@gmail.com
* CreateDate: 2016.09.11
*
*
*/


function GetJsonFromUrl(url) {
	url = url.split('?');
	if (url.length < 2) return {};
	
	url = url[1].split('&');
	if (url == "") return {};
	
	var res = {};
	for (var i = 0; i < url.length; ++i)
	{
		var p = url[i].split('=', 2);
		if (p.length == 1)
			res[p[0]] = "";
		else
			res[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
	}
	return res;
}

function AsyncRun(f) {
	if ("function" != typeof f)
		return;
	setTimeout(f);
}


function PopupMenu(event, ui, props) {
	event.stopPropagation();
	$("#overlay").show();
	
	ui.menu(props)
	.fadeIn(200)
	.position({
		of: event.target,
		at: "right bottom",
		my: "right top"
	});
}

function CollapseMenu(event, ui) {
	if (ui.is(":visible")) {		
		ui.fadeOut(200, function() {
			$(this).position({
				of: window
			})
		});
	}
}

function RenderPopup(callback) {
	
	$('#overlay').click(function(event) {
		$('#overlay').hide();
		CollapseMenu(event, $("#tab_contextmenu"));
		CollapseMenu(event, $("#window_contextmenu"));
	});
	
	$("#options").click(function(event) {
		chrome.tabs.create({url: chrome.extension.getURL("options.html")});
	})
	
	var queryInfo = {
		populate: true,
		windowTypes: ['normal'], // ['app', 'normal', 'panel', 'popup', 'devtools']
	}
	
	var start = new Date();
	var tick = new Date();
	
	chrome.windows.getAll(queryInfo, function(windows) {
		
		console.log(new Date() - start, new Date() - tick);
		tick = new Date();
		
		$("#bookmark_all").click(function(){			
			chrome.bookmarks.getTree(function(tree){
				var bookmark_bar = tree[0].children[0];
				
				chrome.bookmarks.create({
					"parentId": bookmark_bar.id,
					"title": "zz_tab_bookmarks",
				}, function(new_folder){
					console.log("added bookmarks folder", new_folder.id);
					
					for (var w in windows) {
						chrome.bookmarks.create({
							"parentId": new_folder.id,
							"title": windows[w].id.toString(),
						}, (function(tabs){
							return function(new_folder){
								console.log("added bookmarks folder", new_folder.id);
							
								for (var t in tabs) {
									chrome.bookmarks.create({
										"parentId": new_folder.id,
										"title": tabs[t].title,
										"url": tabs[t].url,
									}, function(new_mark){
										console.log("added bookmark", new_mark.id);
									})
								}
					
							}
						})(windows[w].tabs))
					}
					
				})
			})			
		})
		
		
		function SetTabPreview(p) {
			for (var w in windows) {
				for (var t in windows[w].tabs) {
					windows[w].tabs[t].preview = p;
				}
			}
		}
		
		SetTabPreview("");
		
		function MoveTab(old_window_index, old_tab_index, new_window_index, new_tab_index) {
			if (new_tab_index < 0)
				new_tab_index = windows[new_window_index].tabs.length;
			
			chrome.tabs.move(windows[old_window_index].tabs[old_tab_index].id,
				{
					windowId: windows[new_window_index].id,
					index: new_tab_index,
				},
				function(tabs) {
					windows[new_window_index].tabs.splice(new_tab_index, 0, windows[old_window_index].tabs.splice(old_tab_index, 1)[0]);
					if (windows[old_window_index].tabs.length == 0) {
						windows.splice(old_window_index, 1);
					}
				}
			);
		}

		function MoveTabToNewWindow(old_window_index, old_tab_index) {
			chrome.windows.create({
				tabId: windows[old_window_index].tabs[old_tab_index].id,
				focused: false,
			}, function(window) {});
		}
		
		function SuspendTab(tab) {
			var url_json = GetJsonFromUrl(tab.url);
			if ('zztabsuspended' in url_json)
				return;
			
			var url = "chrome://blank/?zztabsuspended"
			+ ("&title=" + encodeURIComponent(tab.title))
			+ ("&url=" + encodeURIComponent(tab.url))
			+ ("&id=" + encodeURIComponent(tab.id))
			+ ("&favIconUrl=" + encodeURIComponent(tab.favIconUrl));
			
			// "" != b ? k += "&icon=" + encodeURIComponent(b) : a.favIconUrl && (k += "&icon=" + encodeURIComponent(a.favIconUrl));
			chrome.tabs.update(tab.id, {url: url})
		}
				
		function UnsuspendTab(tab) {
			var url_json = GetJsonFromUrl(tab.url);
			if ('zztabsuspended' in url_json) {
				chrome.tabs.update(tab.id, {url: chrome.extension.getURL("unsus.html")});
			}
		}
		
		function FreeTabMemory(tab) {
			chrome.tabs.discard(tab.id, function(){});
		}
	
	
		console.log(new Date() - start, new Date() - tick);
		tick = new Date();
		
		
		new Vue({
			el: '#app',
			data: {
				windows: windows
			},
			methods: {
				click: function(win, tab) {
					chrome.tabs.update(tab.id, {active: true}, function() {
						chrome.windows.update(win.id, {focused: true}, function() {
							;
						})
					});
					
					
				},
				contextmenu_window: function(event, win) {
					PopupMenu(event, $("#window_contextmenu"), {
						click: function(event) {
							event.stopPropagation();
						},
						select: function(event, ui) {
							if (ui.item.find("#link_task").length > 0) {
								console.log("link_task");
								console.log(win.history)
								console.log(win.tabs[0].history)
								//MoveTabToNewWindow(windows.indexOf(window), window.tabs.indexOf(tab));
							} else
							if (ui.item.find("#free_memory").length > 0) {								
								AsyncRun(function(){
									for (var t in win.tabs) {
										FreeTabMemory(win.tabs[t]);
									}
									window.close();
								})								
							} else
							if (ui.item.find("#suspend_window").length > 0) {
								AsyncRun(function(){
									for (var t in win.tabs) {
										chrome.tabs.discard(win.tabs[t].id, (function(original_tab){
											return function(_tab){
												if ("undefined" != typeof _tab) {
													SuspendTab(_tab);
												} else {												
													// just check to suppress error log
													if (chrome.runtime.lastError);
												
													SuspendTab(original_tab);
												}
											}
										})(win.tabs[t]));
									}
									window.close();
								})								
							} else
							if (ui.item.find("#restore_window").length > 0) {								
								AsyncRun(function(){
									for (var t in win.tabs) {
										UnsuspendTab(win.tabs[t]);
									}
									window.close();
								})								
							}
							
						}
					});
				},
				contextmenu_tab: function(event, win, tab) {					
					PopupMenu(event, $("#tab_contextmenu"), {
						click: function(event) {
							event.stopPropagation();
						},
						select: function(event, ui) {
							if (ui.item.find("#open_in_new_window").length > 0) {
								MoveTabToNewWindow(windows.indexOf(win), win.tabs.indexOf(tab));
							} else
							if (ui.item.find("#suspend_tab").length > 0) {
								chrome.tabs.discard(tab.id, function(_tab){
									if ("undefined" != typeof _tab) {
										SuspendTab(_tab);
									} else {												
										// just check to suppress error log
										if (chrome.runtime.lastError);
										
										SuspendTab(tab);
									}
									window.close();
								});
							} else
							if (ui.item.find("#restore_tab").length > 0) {
								UnsuspendTab(tab);
								window.close();
							}
						}
					});
				},
				getfavicon: function(tab) {
					var default_favIconUrl = 'img/icon.png';
					
					var url_json = GetJsonFromUrl(tab.url);
					if ('zztabsuspended' in url_json) {
						if ('favIconUrl' in url_json)
							return url_json.favIconUrl;
						else
							return default_favIconUrl;
					}
					
					if (!tab.favIconUrl || tab.favIconUrl.trim() == "")
						return default_favIconUrl;
					else
						return tab.favIconUrl;
				},
				gettitle: function(tab) {
					// console.log(tab.title);
					var url_json = GetJsonFromUrl(tab.url);
					if ('zztabsuspended' in url_json) {
						var prefix = "[SUSPENDED] ";
						if ('title' in url_json)
							return prefix+url_json.title;
						else
							return prefix;
					}
					else
						return tab.title;
				},
				newtab: function(event, win) {
					event.stopPropagation();
					
					chrome.tabs.create({windowId: win.id, index: win.tabs.length}, function(tab) {
						win.tabs.push(tab);
					});
				},
				closetab: function(event, win, tab) {
					event.stopPropagation();
					chrome.tabs.remove(tab.id, function() {
						win.tabs.$remove(tab);
					})
				},
				/*
				isCurrentWindow: function(win) {
					chrome.windows.getCurrent({windowTypes: ['normal']}, function(this_window) {
						if (this_window.id == win.id) {
							console.log("current")
							return true;
						}
						else {
							console.log("not current")
							return false;
						}
					})		
				},
				*/
			}
		})

		$(".tab_favicon").on("error", function(event) {
			this.src='img/icon.png';
		});
		
		
		console.log(new Date() - start, new Date() - tick);
		tick = new Date();
		
		
		$(".window_container").accordion({
			active: false,
			header: '> div.window_head',
			heightStyle: "content",
			collapsible: true,
			activate: function(event, ui) {
				// expanded
				if(ui.newPanel.length) {
					$(this).find(".window_head").droppable("disable")
					$(this).find(".tabs_container").sortable("enable");
				}
				// collapsed
				if(ui.oldPanel.length) {
					$(this).find(".window_head").droppable("enable");
					$(this).find(".tabs_container").sortable("disable");
				}
			},
			icons: {
				"header": "glyphicon glyphicon-menu-right icon_replace",
				"activeHeader": "glyphicon glyphicon-menu-down icon_replace",
			},
		});
		
		console.log(new Date() - start, new Date() - tick);
		tick = new Date();
		
	
		// expand and scroll to current
		chrome.windows.getCurrent({windowTypes: ['normal']}, function(win) {
			var win_index = -1;
			for (var w in windows) {
				if (windows[w].id == win.id) {
					win_index = w;
				}
			}
			if (win_index >= 0) {
				// $("#app").children("div").eq(win_index).accordion("option", "active", 0);
			
				var win_e = $(`[zz_window_index="${win_index}"]`);
				win_e.accordion("option", "active", 0);
			
				chrome.tabs.query({
					active: true,
					windowId: windows[win_index].id,
				}, function(tabs) {
					if (tabs.length <= 0)
						return;
				
					var tab = tabs[0];
				
					var tab_index = -1;
					for (var t in windows[win_index].tabs) {
						if (windows[win_index].tabs[t].id == tab.id) {
							tab_index = t;
						}
					}
					if (tab_index >= 0) {
						var tab_e = $(`[zz_tab_index="${tab_index}"]`, win_e);
					
						$('html, body').animate({
							scrollTop: tab_e.offset().top - 50
						}, 200);
					}
				})
			}
		})
		
		
		// things to do asynchronously
		setTimeout(function() {
			$(".window_head").droppable({
				tolerance: "pointer",
			
				over: function(event, ui) {
					$(this).addClass("ui-state-highlight");
				},
				out: function(event, ui) {
					$(this).removeClass("ui-state-highlight");
				},
				drop: function(event, ui) {
					$(ui.helper).toggle("scale", 200);
				
					$(this).removeClass("ui-state-highlight");
					var this_window_index = parseInt($(this).parents(".window_container").attr("zz_window_index"));
					var sender_window_index = ui.draggable.zz_window_index;
					var sender_tab_index = ui.draggable.zz_tab_index;
				
					MoveTab(sender_window_index, sender_tab_index, this_window_index, -1);
				}
			});
			
			$(".tabs_container").sortable({
				axis: "y",
				connectWith: ".tabs_container",
				disabled: true,
				scroll: true,
				scrollSensitivity: 25,
				scrollSpeed: 10,
				revert: 100,
				helper: "clone",
				containment: "body",
				cursor: "move",
			
				start: function(event, ui) {
					ui.item.zz_window_index = parseInt($(this).parents(".window_container").attr("zz_window_index"));
					ui.item.zz_tab_index = $(this).find(".tab_block_container").index($(ui.item));
				},
				sort: function(event, ui) {
					function scrolling(direction, scrollSpeed) {
						if ("up" == direction) {
							$("body").scrollTop($("body").scrollTop() - scrollSpeed);
						}
						if ("down" == direction) {
							$("body").scrollTop($("body").scrollTop() + scrollSpeed);
						}
					}

					if (!ui.helper) return;
					
					if (!$(".tabs_container").sortable("option", "scroll")) return;
										
					var ui_top_position = ui.offset.top - $(window).scrollTop();
					var ui_bottom_position = ui_top_position + ui.helper.height();
					
					var scrollSensitivity = $(".tabs_container").sortable("option", "scrollSensitivity");
					var scrollSpeed = $(".tabs_container").sortable("option", "scrollSpeed");
					
					if (ui_top_position <= 0 + scrollSensitivity) {
						var ratio = 1 + Math.min(4, Math.abs(ui_top_position/scrollSensitivity));
						scrolling("up", scrollSpeed*ratio);
					}
					else if (ui_bottom_position - $(window).height() >= 0 - scrollSensitivity) {
						var ratio = 1 + Math.min(4, Math.abs((ui_bottom_position - $(window).height())/scrollSensitivity));
						scrolling("down", scrollSpeed*ratio);
					}
				},
				stop: function(event, ui) {
					var sender_window_index = ui.item.zz_window_index;
					var sender_tab_index = ui.item.zz_tab_index;
					var this_window_index = parseInt(ui.item.parents(".window_container").attr("zz_window_index"));
					var this_tab_index = ui.item.index();
				
					MoveTab(sender_window_index, sender_tab_index, this_window_index, this_tab_index);
				},
			});		
		});
		
		
		callback();
	
	})
}



function LoadExternalsStarter(urls, final_callback) {
	if (urls.length == 0)
		final_callback();
	
	var i = -1;
	function Next(){
		i = i + 1;
		if (i == urls.length) {
			final_callback();
			return;
		}
		console.log(`Bootstrap: loading ${urls[i].url}`);
		if ("script" == urls[i].type){
			LoadScript(urls[i].url, Next);
		}
		else if ("stylesheet" == urls[i].type){
			LoadStylesheet(urls[i].url);
			Next();
		}
	}
	Next();
}


function LoadScript(url, callback){
    var script = document.createElement("script");
    script.type = "text/javascript";
	script.charset = "utf-8";

    if (script.readyState){  //IE
        script.onreadystatechange = function(){
            if (script.readyState == "loaded" ||
                    script.readyState == "complete"){
                script.onreadystatechange = null;
                callback();
            }
        };
    } else {  //Others
        script.onload = function(){
            callback();
        };
    }

    script.src = url;
    document.getElementsByTagName("head")[0].appendChild(script);
}

function LoadStylesheet(url){
    var stylesheet = document.createElement("link");
	stylesheet.rel = "stylesheet";
    stylesheet.type = "text/css";
	stylesheet.charset = "utf-8";

    stylesheet.href = url;
    document.getElementsByTagName("head")[0].appendChild(stylesheet);
}


document.addEventListener('DOMContentLoaded', function() {
	
	LoadExternalsStarter([
		// css
		{type:"stylesheet", url:"3rd/jquery-ui-1.12.1/jquery-ui.min.css"},
		// {type:"stylesheet", url:"3rd/jquery-ui-1.12.1/jquery-ui.structure.min.css"},
		{type:"stylesheet", url:"3rd/bootstrap-3.3.7-dist/css/bootstrap.min.css"},
		// script
		{type:"script", url:"3rd/jquery-3.1.0/jquery-3.1.0.min.js"},
		// {type:"script", url:"3rd/bootstrap-3.3.7-dist/js/bootstrap.min.js"},
		{type:"script", url:"3rd/vue-1.0.28-csp/vue.min.js"},
		{type:"script", url:"3rd/jquery-ui-1.12.1/jquery-ui.min.js"},
	], function(){		
		/*
		chrome.system.display.getInfo(function(display) {
			$("body").height(display[0].workArea.height*1.2);
			$("body").width(Math.min(400, display[0].workArea.width/3));
		})
		*/
		
		$("body").hide();
		RenderPopup(function(){
			$("body").show();
		})
	})
});
