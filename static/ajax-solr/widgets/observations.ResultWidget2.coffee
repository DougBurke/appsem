# Widgets for the observations view.
#
# NOTE: this has not been tested

$ =jQuery

encodeObsuri = (obsuri) ->
  [l,r] = obsuri.split '/'
  "#{l}-#{r}"

getObsvtime = (self, facetHandler, year) ->
  $('<a href="#"/>').text(year)
    .click(facetHandler self, 'obsvtime_d', "[#{year} TO #{year}]")

# copy of facetHandler; see discussion in publications.ResultWidget2.coffee

facetHandler2 = (self, facet_field, facet_value) ->
  () ->
    self.manager.store.remove 'fq'
    self.manager.store.addByValue 'fq', "#{facet_field}:#{facet_value}"
    self.manager.doRequest 0
    return false

AjaxSolr.ResultWidget = AjaxSolr.AbstractWidget.extend

  afterRequest: () ->
    self = this
    $(self.target).empty()

    # for the moment we don't actually do anything with docids
    docids = []
    for doc in self.manager.response.response.docs
      snippet = AjaxSolr.theme 'snippet', doc, getObsvtime(self, facetHandler2, doc.obsvtime_d)
      title = AjaxSolr.theme 'title', doc
      pivot = AjaxSolr.theme 'pivot', doc, self.facetHandler('obsids_s', doc.obsids_s)
      result = AjaxSolr.theme('result', doc, snippet, title, pivot, self)
      $(self.target).append(result)

      items = []
      gaga = self.facetLinks "emdomains_s", doc.emdomains_s
      items.concat gaga
      AjaxSolr.theme 'list_items', "#links_#{encodeObsuri doc.obsids_s}", gaga, '| '
      docids.push doc.obsids_s

    # console.log "DOCIDS: #{docids}"
    return true

  facetLinks: (facet_field, facet_values) ->
    if facet_values?
      (AjaxSolr.theme('facet_link', val, this.facetHandler(facet_field, val)) for val in facet_values)
    else
      []

  moreHandler: (doc) ->
    name = encodeObsuri doc.obsids_s
    () ->
      $("#am_#{name}").hide()
      $("#p_#{name}").show()
      $("#al_#{name}").show()
      return false

  lessHandler: (doc) ->
    name = encodeObsuri doc.obsids_s
    () ->
      $("#am_#{name}").show()
      $("#p_#{name}").hide()
      $("#al_#{name}").hide()
      return false

  saveHandler: (doc) ->
    () ->
      data = JSON.stringify
        savedobsv: doc.obsids_s
        target: doc.targets_s
        title: doc.obsv_title
      doIt = (data) ->
        if data.success is "defined"
          name = encodeObsuri doc.obsids_s
          $("#saveobsv_#{name}").hide()
          $("#delobsv_#{name}").show()
        return false

      $.post "#{SITEPREFIX}/saveobsv", data, doIt
      return false

  deleteHandler: (doc) ->
    () ->
      data = JSON.stringify
        obsid: doc.obsids_s
      doIt = (data) ->
        if data.success is "defined"
          name = encodeObsuri doc.obsids_s
          $("#saveobsv_#{name}").show()
          $("#delobsv_#{name}").hide()
        return false

      $.post "#{SITEPREFIX}/deleteobsv", data, doIt
      return false

  facetHandler: (facet_field, facet_value) ->
    self = this
    () ->
      self.manager.store.remove 'fq'
      self.manager.store.addByValue 'fq', "#{facet_field}:#{facet_value}"
      self.manager.doRequest 0
      return false

  beforeRequest: () ->
    $(this.target).html $('<img/>').attr('src', '/semantic2/alpha/static/images/ajax-loader.gif')
    return true

