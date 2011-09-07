/*
 * Common code for AstroExplorer
 */

var SITEPREFIX = '/semantic2/alpha';
var SOLRURL = SITEPREFIX + '/solr/';

(function() {
    function nop() {}
    if (! ("console" in window) || !("firebug" in console)) {
	var names = ["log", "debug", "info", "warn", "error", "assert", "dir",
		     "dirxml", "group", "groupEnd", "time", "timeEnd", "count",
		     "trace", "profile", "profileEnd"];
	window.console = {};
	for (var i = 0; i < names.length; ++i) {
	    window.console[names[i]] = nop;
	}
    }
})();

/*
 * Taken from
 *    http://addyosmani.com/largescalejavascript/
 */

var mediator = (function(){
    var subscribe = function(channel, fn){
        if (!mediator.channels[channel]) mediator.channels[channel] = [];
        mediator.channels[channel].push({ context: this, callback: fn });
        return this;
    },
    
    publish = function(channel){
        if (!mediator.channels[channel]) return false;
        var args = Array.prototype.slice.call(arguments, 1);
        for (var i = 0, l = mediator.channels[channel].length; i < l; i++) {
            var subscription = mediator.channels[channel][i];
            subscription.callback.apply(subscription.context, args);
        }
        return this;
    };
    
    return {
        channels: {},
        publish: publish,
        subscribe: subscribe,
        installTo: function(obj){
            obj.subscribe = subscribe;
            obj.publish = publish;
        }
    };
    
}());

(function ($) {
    $(function () {

	function setLoggedIn(email) {
	    $('a#logouthref').text("logout " + email);
	    $('.userloggedin').each(function () { $(this).show(); });
	    $('.userloggedout').each(function () { $(this).hide(); });
	    mediator.publish('user/login', email);
	}

	function setLoggedOut() {
	    $('.userloggedout').each(function () { $(this).show(); });
	    $('.userloggedin').each(function () { $(this).hide(); });
	    mediator.publish('user/logout');
	}
	
	function myjsonp(data){
            return data; //so that we dont handle url on server
	};

	$('#gosearch').click(function(){
            alert("not yet implemented");
	});

	// We allow multiple login links
	$('a.userlogin').each(function () { 
	    $(this).click(function () {
		var loc = encodeURIComponent(window.location);
		$.ajax({
		    url: "http://labs.adsabs.harvard.edu" + SITEPREFIX + "/adsjsonp?callback=?",
		    dataType: 'jsonp',
		    jsonpcallback: myjsonp,
		    success: function (data) {
			
			if (data.email === undefined || data.email == '') {
			    // for now hard code this particular login link rather than use the one that triggered the callback
			    $('a#loginhref').click(function () {
				var thispage = window.location;
				var prefix = thispage.protocol + '//' + location.host;
				var loc = encodeURIComponent(prefix + SITEPREFIX + "/login?redirect=" + window.location);
				window.location.href = "http://adsabs.harvard.edu/cgi-bin/nph-manage_account?man_cmd=login&man_url=" + loc;
			    });
			    $('a#loginhref').trigger('click');
			    
			} else {
			    // setLoggedin(data.email);
			    $.post(SITEPREFIX + '/addtoredis', JSON.stringify(data), function() {
				window.location.reload();
			    });
			}
		    }
		});
	    });
	});

	$('a#logouthref').click(function () {
            var loc = encodeURIComponent(window.location);
            window.location.href = SITEPREFIX + "/logout?redirect=" + loc;
	});
	
        $.getJSON(SITEPREFIX + '/getuser', function(data) {
	    if (data.email === undefined || data.email == 'undefined') {
		// user is not logged in according to ADS, so check
		// our database.
		//
                if (data.startup !== undefined && data.startup != 'undefined') {
                    $.ajax({
			url: "http://labs.adsabs.harvard.edu" + SITEPREFIX + "/adsjsonp?callback=?",
			dataType: 'jsonp',
			jsonpcallback: myjsonp,
			success: function (adata) {
                            if (adata.email !== undefined && adata.email != '') {
				setLoggedIn(adata.email);
				$.post(SITEPREFIX + '/addtoredis', JSON.stringify(adata));
                            } else {
				setLoggedOut();
			    }
			}
                    });
                } else {
		    setLoggedOut();
		}

	    } else {
		setLoggedIn(data.email);
            }
        });

    });
})(jQuery);
