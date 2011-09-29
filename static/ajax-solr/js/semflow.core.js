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

/**
 * Given a facet name, return a human-readable version using the supplied
 * namemap; if there is no mapping for this field, or the namemap
 * is not suppleid then the input name is returned.
 *
 * It may be better to make some form of mapping object
 * or hide the map within this routine, so you only end up
 * sending the routine around.
 */
function cleanFacetName(name, namemap) {
    if (namemap === undefined) {
	return name;
    } else {
	return namemap[name] || name;
    }
}

/**
 * Given a facet constraint remove Solr-specific features:
 *    "..."    -> ...
 *    [a TO a] -> a
 *    [a TO b] -> a to b
 */
function cleanFacetValue(label) {
    if (label == '') { return label; }
    
    var l = label.length;
    var firstChar = label[0];
    var lastChar = label[l-1];
    
    if (firstChar == '"' && lastChar == '"') {
	label = label.substr(1, l-2);
    } else if (firstChar == '[' && lastChar == ']') {
	var idx = label.indexOf(' TO ');
	if (idx !== -1) {
	    label = label.substr(1, l-2);
	    var l = label.substr(0, idx-1);
	    var r = label.substr(idx+3);
	    if (l == r) {
		label = l;
	    }
	}
    }
    
    return label;
}

/**
 * Given a saved search, which looks something like
 * "fq=keywords_s%3A%22stars%20luminosity%20function%3Bmass%20function%22&fq=author_s%3A%22Stahl%2C%20O%22&fq=instruments_s%3AMAST%2FIUE%2FLWR&q=*%3A*"
 * return a (hopefully) human-readable version as an array of strings.
 *
 * We split up into name,value pairs for each constriant,
 * then replace decoded characters in the value, and then
 * try to clean up so that
 *     name is human readable
 *     Solr-specific punctation in the value is removed
 * and combine constraints from the same field/name.
 *
 * namemap is the name mapping needed by cleanFacetName;
 * it can be undefined.
 */
function searchToText(searchTerm, namemap) {
    // lazy way to remove the trailing search term
    var s = "&" + searchTerm;
    s = s.replace('&q=*%3A*', '');
    
    // only decode after the initial split to protect against the
    // unlikely event that &fq= appears as part of a search term.
    var terms = s.split(/&fq=/);
    
    // ignore the first entry as '' by construction
    var out = {};
    var i, l;
    for (i = 1, l = terms.length; i < l; i++) {
	var toks = decodeURIComponent(terms[i]).split(':', 2);
	var name = toks[0];
	var value = cleanFacetValue(toks[1]);
	if (name in out) {
	    out[name].push(value);
	} else {
	    out[name] = [value];
	}
    }
    
    var outs = [];
    for (var name in out) {
	outs.push(cleanFacetName(name, namemap) + "=" + out[name].join(','));
    }
    return outs;
}

/**
 * Mapping between field name as used by Solr and the text we
 * use to display to the user.
 *
 * Uses include cleanFacetName() and CurrentSearchWidget().
 */
var fieldname_map = {
    'keywords_s': 'Keyword',
    'author_s': 'Author',
    'objecttypes_s': 'Object Type',
    'objectnames_s': 'Object Name',
    'obsvtypes_s': 'Observation Type',
    'obsids_s': 'Observation ID',
    'instruments_s': 'Instrument',
    'obsv_mission_s': 'Mission',
    'missions_s': 'Mission', // is missions_s still valid?
    'emdomains_s': 'Wavelength',
    'targets_s': 'Target Name',
    'datatypes_s': 'Data Type',
    'propids_s': 'Proposal ID',
    'proposaltype_s': 'Proposal Type',
    'proposalpi_s': 'Proposal PI',
    'pubyear_i': 'Publication Year',
    'ra_f': 'RA',
    'dec_f': 'Dec',
    'fov_f': 'Field of View',
    'obsvtime_d': 'Observation Date',
    'exptime_f': 'Exposure Time',
    'data_collection_s': 'Data Collection',
    'resolution_f': 'Spatial resolution',
    't_resolution_f': 'Temporal resolution'
};

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
