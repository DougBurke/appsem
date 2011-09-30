/*
 * Theme for saved page
 *
 * THIS IS OLD CODE; MAKE CHANGES TO ../coffee/saved.theme.coffee
 */

(function ($) {

    /**
     * Create a title for a saved item (e.g. searches or publications) area.
     */
    AjaxSolr.theme.prototype.saved_title = function (text) {
	return $('<h1/>').text(text);
    };

    /**
     * Set or unset all the buttons in the table.
     */
    function changeAllButtons(newstate) {
	return function () {
	    $(this.form).find('input[type=checkbox]').each(function() { this.checked = newstate; });
	};
    };

    /**
     * Create the form actions for the saved-item form.
     */
    AjaxSolr.theme.prototype.saved_formactions = function (bibtexHandler, myADSHandler) {
	return $('<div class="formactions"/>')
	    .append($('<input type="button" value="Mark all"/>').click(changeAllButtons(true)))
	    .append($('<input type="button" value="Clear all"/>').click(changeAllButtons(false)))
	    .append($('<input type="submit" value="Delete marked" name="action"/>'))
	    .append($('<input type="button" value="Get as BibTex"/>').click(bibtexHandler))
	    .append($('<button type="button" name="myads" value="Send to myADS"/>')
		    .click(myADSHandler)
		    .append($('<img alt="[myADS logo]"/>')
			    .attr('src', SITEPREFIX + '/static/images/ADSlabs-button.png'))
		   );
    }

    /**
     * Create the THEAD block for the saved-item table.
     *
     *   cols is an array of column names.
     *
     * The first column is created empty and should not be included in cols.
     */
    AjaxSolr.theme.prototype.saved_tablehead = function (cols) {
	var $tr = $('<tr/>').append('<th/>');
	$.each(cols, function (index, value) {
	    $tr.append($('<th/>').text(value));
	});
	var $out = $('<thead/>').append($tr);
	return $out;
    }

    /**
     * Create a table row for the saved-item table.
     *
     *   row is an array of items to store in the table
     *
     */
    AjaxSolr.theme.prototype.saved_tablerow = function (row) {
	// For now dropping the id value of idfrag-ctr# for the row.
	var $out = $('<tr class="saveditem"/>');
	$.each(row, function (index, value) {
	    $out.append($('<td/>').append($(value)));
	});
	return $out;
    }

    /**
     * Create the list of saved items.
     *
     *   idfrag is used to create the various names - e.g.
     *      an id of 'saved-' + idfrag + '-form' for the form
     *   cols is an array of column headers (not including the
     *     first column which is empty/the selection column)
     *   rows is an array of rows, where each item is an 
     *     array of values to display.
     *
     *   bibtexHandler is the click handler for the 'export as BibTex' button
     *   myADSHandler is the click handler for the 'export to myADS' button
     *
     */
    AjaxSolr.theme.prototype.saved_items = function (idfrag, cols, rows, bibtexHandler, myADSHandler) {
	var $out = $('<form action="#"/>').attr('id', 'saved-' + idfrag + '-form');
	var $actions = AjaxSolr.theme('saved_formactions', bibtexHandler, myADSHandler);
		     
	var $table = $('<table class="tablesorter"/>')
	    .attr('id', 'saved-' + idfrag + '-table')
	    .append(AjaxSolr.theme('saved_tablehead', cols));

	var $tbody = $('<tbody/>');
	$.each(rows, function (index, value) {
	    $tbody.append(AjaxSolr.theme('saved_tablerow', value));
	});
	$table.append($tbody);

	$out.append($actions).append($table);
	return $out;
    }

})(jQuery);
