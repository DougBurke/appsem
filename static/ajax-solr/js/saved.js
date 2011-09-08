/*
 * Code for the saved page
 */

// var fancyboxOpts = { 'autoDimensions': false, 'width': 1024, 'height': 768 };

(function ($) {

    /**
     * Make a POST request to the ADS servers using the given
     * URL path and apply the given callback to the response.
     */
    function doADSproxy(urlpath, callback) {
	$.post(SITEPREFIX + '/adsproxy',
	       JSON.stringify({urlpath: urlpath}),
	       callback);
    };

    /**
     * Set up the 'Submit a delete' action for the table.
     */
    function submitDeleteAction(path, idname) {
	return function () {
	    var data = [];
	    $(this).find('input[type=checkbox][checked|=true]').each(function() {
		data.push(this.value);
	    });
	    if (data.length == 0) { 
		alert("No items have been selected.");
		return false; 
	    }
	    var map = { action: "delete" };
	    map[idname] = data;
	    $.post(SITEPREFIX+path, JSON.stringify(map), function (resp) {
		// reload page on success or error; perhaps should just
		// re-create the given element
		window.location.reload();
	    });
	};
    };

    /**
     * Given an array of bibcodes, get the BibTex entries from ADS
     * and display to the user.
     */
    function getBibTexFromADS(bibcodes) {
	// alert("bibcodes:\n" + bibcodes.join('\n')); $.fancybox.hideActivity(); return false;

	// Note: we wrap up the plain text returned by ADS since it has a content type of
	//       text/html; what would happen if we changed the content type in resp instead?
	doADSproxy('/cgi-bin/nph-bib_query?data_type=BIBTEX&' +
		   bibcodes.map(encodeURIComponent).join('&'),
		   function (resp) { $.fancybox('<pre>'+resp+'</pre>'); return false; });
    }

    /**
     * Given an array of bibcodes, send to myADS for saving in a library.
     */
    function saveToMyADS(bibcodes) {
	// alert("bibcodes:\n" + bibcodes.join('\n')); $.fancybox.hideActivity(); return false;
	doADSproxy('/cgi-bin/nph-abs_connect?library=Add&' +
		   bibcodes.map(function (item) { return 'bibcode=' +
						  encodeURIComponent(item); }).join('&'),
		   function(resp) { $.fancybox(resp); return false; });  
    }

    /**
     * Handle a request for the publication table by getting the
     * bibcodes of all selected items and passing them to the handler.
     */
    function handlePublications(handler) {
	return function () {
	    var form = this.form;
	    var data = [];
	    $(form).find('input[type=checkbox][checked|=true]').parent().nextAll('td').find('span.bibcode').each(function() {
		data.push($(this).text());
	    });
	    if (data.length == 0) { 
		alert("No items have been selected.");
		return false;
	    }
	    $.fancybox.showActivity();
	    handler(data);
	};
    }

    /**
     * Handle a request for the search table by getting the
     * bibcodes of all selected items and passing them to the handler.
     *
     * At present we restrict to a single search.
     */
    function handleSearches(handler) {
	return function () {
	    var form = this.form;
	    var data = [];
	    $(form).find('input[type=checkbox][checked|=true]').each(function() {
		data.push(this.value);
	    });
	    if (data.length == 0) { 
		alert("No items have been selected.");
		return false; 
	    } else if (data.length > 1) {
		alert("Only 1 search can be retrieved at a time (you selected " + data.length + ")");
		return false;
	    }
	    $.fancybox.showActivity();
	    
	    // TODO: We limit the search for now; really should page through the results.
	    var nrows = 100;
	    var query = SOLRURL + 'select?' + data[0] +
		'&fl=bibcode' + '&rows=' + nrows +
		'&wt=json&json.wrf=?';
	    
	    $.getJSON(query, function (response) {
		var resp = response.response;
		if (resp.numFound === 0) {
		    $.fancybox.hideActivity();
		    alert("No publications found for this search.");
		    return false;
		}
		
		if (resp.numFound > nrows) {
		    alert("Warning: results restricted to the first " + nrows + " of " + resp.numFound);
		}
		
		var bibcodes = [];
		for (var i = 0, n = resp.docs.length; i < n; i++) {
		    bibcodes.push(resp.docs[i].bibcode);
		}
		handler(bibcodes);
	    });
	};
    }

    // Use the actual time value to sort the time column rather than
    // the text, and the text for the other columns. a bit ugly
    //
    var tsortopts = {
	headers: { 0: { sorter: false } },
	textExtraction: function(node) {
	    var val = $(node).find('span').attr('value');
	    if (val === undefined) {
		return $(node).text();
	    } else {
		return val;
	    }
	}
    };
    
    /**
     * Create the saved searches table where searches is an array
     * of objects with fields:
     *   searchuri:      "fq=missions_s%3AMAST%2Feuve&q=*%3A*",
     *   searchtime:     1314367771876
     *   searchtimestr:  "Fri, 26 Aug 2011 14:09:31 GMT"
     *   searchctr:      0
     */
    function createSavedSearches(searches) {
	var nsearch = searches.length;

	var rows = [];
	for (var i = 0; i < nsearch; i++) {
	    var s = searches[i];
	    var scpts = searchToText(s.searchuri, fieldname_map);
	    var $search = $('<a/>').attr('href', SITEPREFIX + '/explorer/publications#' + s.searchuri);
	    for (var j = 0, ns = scpts.length; j < ns; j++) {
		$search.append($('<div/>').text(scpts[j]));
	    }
	    rows.push([
		$('<input type="checkbox" name="searchid"/>')
		    .attr('value', s.searchuri),
		$('<span/>')
		    .attr('value', s.searchtime)
		    .text(s.searchtimestr),
		$search // not sure I like this version
		/***
		$('<a/>')
		    .attr('href', SITEPREFIX + '/explorer/publications#' + s.searchuri)
		    .text(scpts.join('\n'))
		    ***/
	    ]);
	}

	var $div = $('div#saved-searches');
	$div.append(AjaxSolr.theme('saved_title', 'Saved searches'));
	$div.append(AjaxSolr.theme('saved_items', 'searches', 
				   ['Date saved', 'Search terms'],
				   rows,
				   handleSearches(getBibTexFromADS),
				   handleSearches(saveToMyADS)
				  ));

	$('#saved-searches-form').submit(submitDeleteAction('/deletesearches', 'searchid'));
	$('#saved-searches-table').tablesorter(tsortopts);
    }

    /**
     * Create the saved publications table where pubs is an array
     * of objects with fields:
     *   pubid:       "f779d03a-4865-4b45-80fc-344d51388ea5"
     *   pubtime:     1314367771876
     *   pubtimestr:  "Fri, 26 Aug 2011 14:09:31 GMT"
     *   linkuri:     "bibcode%3A2004ApJ...606.1174B"
     *   linktext:    "The O VI and C III Lines at 1032 and 977 Å in Hyades F Stars"
     *   bibcode:     "2004ApJ...606.1174B"
     *   pubctr:      22
     */
    function createSavedPublications(pubs) {

	var npub = pubs.length;

	var rows = [];
	for (var i = 0; i < npub; i++) {
	    var p = pubs[i];
	    rows.push([
		$('<input type="checkbox" name="pubid"/>')
		    .attr('value', p.pubid),
		$('<span/>')
		    .attr('value', p.pubtime)
		    .text(p.pubtimestr),
		$('<a/>')
		    .attr('href', SITEPREFIX + '/explorer/publications#fq=' + p.linkuri + '&q=*%3A*')
		    .text(p.linktext),
		$('<span class="bibcode">').text(p.bibcode)
	    ]);
	}

	var $div = $('div#saved-pubs');
	$div.append(AjaxSolr.theme('saved_title', 'Saved Publications'));
	$div.append(AjaxSolr.theme('saved_items', 'pubs', 
				   ['Date saved', 'Title', 'Bibcode'],
				   rows,
				   handlePublications(getBibTexFromADS),
				   handlePublications(saveToMyADS)
				  ));

	$('#saved-pubs-form').submit(submitDeleteAction('/deletepubs', 'pubid'));
	$('#saved-pubs-table').tablesorter(tsortopts);
    }

    /**
     * The user has no saved searches.
     */
    function noSavedSearches() {
	var $div = $('div#saved-searches');
	$div.append(AjaxSolr.theme('saved_title', 'No saved searches'));
    }
    
    /**
     * The user has no saved publications.
     */
    function noSavedPublications() {
	var $div = $('div#saved-searches');
	$div.append(AjaxSolr.theme('saved_title', 'No saved publications'));
    }
    
    // When a user logs in we need to create the saved search and publication
    // tables.
    //
    // TODO: synchronization on the showing of the tables?
    //
    mediator.subscribe('user/login', function (email) {

        $.getJSON(SITEPREFIX + '/savedsearches2', function (data) {
	    var searches = data.savedsearches;
	    if (searches.hassearches) {
		createSavedSearches(searches.savedsearches);
	    } else {
		noSavedSearches();
	    }
        });

        $.getJSON(SITEPREFIX + '/savedpubs2', function (data) {
	    var pubs = data.savedpubs;
	    if (pubs.haspubs) {
		createSavedPublications(pubs.savedpubs);
	    } else {
		noSavedPublications();
	    }
        });

    });

    /***
	do not need to hide/display things since this is handled by
	the generic userloggedin/out classes, although we may decide that
	that is not a good idea in the long term.

    mediator.subscribe('user/logout', function () {
        alert("SAVE: User logout/no user.");
    });
    ***/
    
})(jQuery);
