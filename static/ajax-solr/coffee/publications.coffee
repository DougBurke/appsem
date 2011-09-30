# Code for the publications page

$ = jQuery

# Manager is a global variable in the original JavaScript code,
# so we need to add this to the window object (although I have chosen
# to make it general rather than explicit). TODO: pass it around instead

root = exports ? this

# should the following be wrapped by
# $ ->
# ?

root.Manager = new AjaxSolr.Manager(solrUrl: SOLRURL)
Manager = root.Manager

Manager.addWidget(new AjaxSolr.ResultWidget
  id: 'result'
  target: '#docs'
  )

renderHeader = (perPage, offset, total) ->
  $('#pager-header')
    .html($('<span/>')
    .text("displaying #{Math.min(total, offset+1)} to #{Math.min(total, offset+perPage)} of #{total} ")
    .append($('<a class="save" id="save-search" href="#">save search</a>'))
    .append($('<a class="delete" id="delete-search" style="display: none" href="#">delete search</a>')))

  getloc = () -> location.href.split('#')[1]

  $('#save-search').click(() ->
    $.post "#{SITEPREFIX}/savesearch",
      JSON.stringify(savedsearch: getloc()),
      (data) ->
        if data.success is 'defined'
          $('#save-search').hide()
          $('#delete-search').show()

    return false
    )

  $('#delete-search').click(() ->
    $.post "#{SITEPREFIX}/deletesearch",
    JSON.stringify(searchid: getloc()),
    (data) ->
      if data.success is 'defined'
          $('#delete-search').hide()
          $('#save-search').show()

    return false
    )

  # Hide the 'save search' button if no search has been made.
	# TODO: this check may need to be updated when we support OR-style
  # queries
  if Manager.store.values('fq').length is 0
    $('#save-search').hide()

  # This gets called all the time. How to avoid this?
  # TODO: do not need to call this when not logged in
  $.getJSON "#{SITEPREFIX}/savedsearches", (data) ->
    searchurl = getloc()
    if data.savedsearches isnt 'undefined'
      searches = data.savedsearches
      if searchurl in searches
        $('#save-search').hide()
        $('#delete-search').show()
    else
      $('#save-search').hide()
      $('#delete-search').hide()

Manager.addWidget(new AjaxSolr.PagerWidget
  id: 'pager'
  target: '#pager'
  prevLabel: '&lt;'
  nextLabel: '&gt;'
  innerWindow: 1
  renderHeader: renderHeader
  )

fields = ['keywords', 'author', 'objecttypes', 'objectnames', 'obsvtypes', 'obsids', 'instruments', 'missions', 'emdomains', 'targets', 'datatypes', 'propids', 'proposaltype', 'proposalpi']
facet_fields = ['keywords_s', 'author_s', 'objecttypes_s', 'objectnames_s', 'obsvtypes_s', 'obsids_s', 'instruments_s', 'obsv_mission_s', 'emdomains_s', 'targets_s', 'datatypes_s', 'propids_s', 'proposaltype_s', 'proposalpi_s']

makeTagCloud = (ctr) ->
  new AjaxSolr.TagcloudWidget
    id: fields[ctr]
    target: "##{fields[ctr]}"
    field: facet_fields[ctr]

for i in [0...fields.length]
  Manager.addWidget makeTagCloud(i)

Manager.addWidget(new AjaxSolr.CurrentSearchWidget
  id: 'currentsearch'
  target: '#selection'
  fieldmap: fieldname_map
  allowmulti: facet_fields
  )

Manager.addWidget(new AjaxSolr.AutocompleteWidget
  id: 'text'
  target: '#search'
  field: 'text'
  fields: facet_fields.concat ['bibcode']
  fieldmap: fieldname_map
  )

Manager.addWidget(new AjaxSolr.YearWidget
  id: 'pubyear'
  target: '#pubyear'
  field: 'pubyear_i'
  datamin: 1978
  datamax: 2011
  datastep: 1
  )

numericfields = ['ra', 'dec']
facet_numericfields = ['ra_f', 'dec_f']
min_numericfields = [0.0, -90.0]
max_numericfields = [360.0, 90.0]
step_numericfields = [15.0, 10.0]

makeSlider = (ctr) ->
  new AjaxSolr.DualSliderWidget
    id: numericfields[ctr]
    target: "##{numericfields[ctr]}"
    field: facet_numericfields[ctr]
    datamin: min_numericfields[ctr]
    datamax: max_numericfields[ctr]
    datastep: step_numericfields[ctr]

for i in [0...numericfields.length]
  Manager.addWidget makeSlider(i)

Manager.addWidget(new AjaxSolr.DualSliderWidget
  id: 'exptime'
  target: '#exptime'
  field: 'exptime_f'
  datamin: 0
  datamax: 350
  datastep: 1

  toFacet: (val) -> val * 1000
  fromFacet: (val) -> val / 1000
  )

Manager.addWidget(new AjaxSolr.DateRangerWidget
  id: 'obsvtime'
  target: '#obsvtime'
  field: 'obsvtime_d'
  startYear: 1977
  datastep: 10
  )

Manager.setStore(new AjaxSolr.AstroExplorerStore())
Manager.store.exposed = [ 'fq', 'q' ]
Manager.init()
Manager.store.addByValue 'q', '*:*'

params =
  'facet': true,
  'facet.field': facet_fields,
  'facet.limit': 20, # change this to set autocompletion limits differently...or solr 1.5
  'facet.mincount': 1,
  'f.topics.facet.limit': 50,
  'json.nl': 'map',
  'sort':'citationcount_i desc',
  'rows': 20,
  'stats': 'true',
  'stats.field': facet_numericfields.concat ['exptime_f', 'pubyear_i']

for name,val of params
  Manager.store.addByValue name, val

Manager.doRequest()

