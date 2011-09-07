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
     * Check the saved-publication table to find all checked items
     * and export them to BibTex using the ADS server.
     */
    function getAsBibTex() {
	var form = this.form;
	var data = [];
	// could use input:checked but I think I read that there may
	// be issues, so use the more explicit version.
	//
	$(form).find('input[type=checkbox][checked|=true]').parent().nextAll('td').find('span.bibcode').each(function() {
	    data.push($(this).text());
	});
	if (data.length == 0) { 
	    alert("No items have been selected.");
	    return false;
	}
	$.fancybox.showActivity();
	doADSproxy('/cgi-bin/nph-bib_query?data_type=BIBTEX&' +
		   data.map(encodeURIComponent).join('&'),
		   function (resp) { $.fancybox('<pre>'+resp+'</pre>'); });
	return false;
    };

    /**
     * Get the BibTex entries for all the publications in the saved
     * search.
     *
     * At present we restrict to one search.
     */
    function getSearchAsBibTex() {
	var form = this.form;
	var data = [];
	$(form).find('input[type=checkbox][checked|=true]').each(function() {
	    data.push(this.value);
	});
	if (data.length == 0) { 
	    alert("No items have been selected.");
	    return false; 
	} else if (data.length > 1) {
	    alert("Only 1 search can be retrieved as BibTex at a time (you selected " + data.length + ")");
	    return false;
	}
	$.fancybox.showActivity();

	var query = SOLRURL + 'select?' + data[0] +
            '&fl=bibcode' +
            '&wt=json&json.wrf=?';

	$.getJSON(query, function (response) {
	    if (response.response.numFound === 0) {
		$.fancybox.hideActivity();
		alert("No publications found for this search.");
		return false;
	    }
	    var bibcodes = [];
	    for (var i = 0, n = response.response.docs.length; i < n; i++) {
		bibcodes.push(response.response.docs[i].bibcode);
	    }
	    doADSproxy('/cgi-bin/nph-bib_query?data_type=BIBTEX&' +
		       bibcodes.map(encodeURIComponent).join('&'),
		       function (resp) { $.fancybox('<pre>'+resp+'</pre>'); return false; });
	});
    };

    /**
     * Save all the selected publications to a myADS library.
     */
    function saveToMyADS() {
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
	doADSproxy('/cgi-bin/nph-abs_connect?library=Add&' +
		   data.map(function (item) { return 'bibcode=' +
					      encodeURIComponent(item); }).join('&'),
		   function(resp) { $.fancybox(resp); return false; });  
    };
   
    /**
     * Save all the publications in the saved search to a myADS library.
     *
     * At present we restrict to one search.
     */ 
    function saveSearchToMyADS() {
	var form = this.form;
	var data = [];
	$(form).find('input[type=checkbox][checked|=true]').each(function() {
	    data.push(this.value);
	});
	if (data.length == 0) { 
	    alert("No items have been selected.");
	    return false;
	} else if (data.length > 1) {
	    alert("Only 1 search can be saved to myADS at a time (you selected " + data.length + ")");
	    return false;
	}
	$.fancybox.showActivity();

	var query = SOLRURL + 'select?' + data[0] +
            '&fl=bibcode' +
            '&wt=json&json.wrf=?';
	
	$.getJSON(query, function (response) {
	    if (response.response.numFound === 0) {
		$.fancybox.hideActivity();
		alert("No publications found for this search.");
		return false;
	    }
	    var bibcodes = [];
	    for (var i = 0, n = response.response.docs.length; i < n; i++) {
		bibcodes.push(response.response.docs[i].bibcode);
	    }
	    var bibcodelist = bibcodes.map(function (item) { return 'bibcode=' +
							     encodeURIComponent(item); });
	    doADSproxy('/cgi-bin/nph-abs_connect?library=Add&' + bibcodelist.join('&'),
		       function(resp) { $.fancybox(resp); return false; });
	});
    };

    /**
     * Given a saved search, which looks something like
     * "fq=keywords_s%3A%22stars%20luminosity%20function%3Bmass%20function%22&fq=author_s%3A%22Stahl%2C%20O%22&fq=instruments_s%3AMAST%2FIUE%2FLWR&q=*%3A*"
     * return a (hopefully) human-readable version.
     */
    function searchToText(searchTerm) {
	// lazy way to remove the trailing search term
	var s = "&" + searchTerm;
	s = s.replace('&q=*%3A*', '');
	
	// only decode after the initial split to protect against the
	// unlikely event that &fq= appears as part of a search term.
	var terms = s.split(/&fq=/);
	
	// ignore the first entry as '' by construction
	var out = "";
	var i;
	for (i = 1; i < terms.length; i++) {
	    var toks = decodeURIComponent(terms[i]).split(':', 2);
	    out += toks[0] + "=" + toks[1] + " ";
	}
	
	return out;
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
	    rows.push([
		$('<input type="checkbox" name="searchid"/>')
		    .attr('value', s.searchuri),
		$('<span/>')
		    .attr('value', s.searchtime)
		    .text(s.searchtimestr),
		$('<a/>')
		    .attr('href', SITEPREFIX + '/explorer/publications#' + s.searchuri)
		    .text(searchToText(s.searchuri))
	    ]);
	}

	var $div = $('div#saved-searches');
	$div.append(AjaxSolr.theme('saved_title', 'Saved searches'));
	$div.append(AjaxSolr.theme('saved_items', 'searches', 
				   ['Date saved', 'Search terms'],
				   rows,
				   getSearchAsBibTex,
				   saveSearchToMyADS
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
				   getAsBibTex,
				   saveToMyADS
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
