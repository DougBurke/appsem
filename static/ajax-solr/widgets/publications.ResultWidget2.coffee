# Widgets for the publications view.

$ = jQuery

# Should we be using facetLinks?

getAuthors = (self, facetHandler, authors) ->
  $out = $('<span class="authors"/>')
  flag = false
  for author in authors
    if flag then $out.append('; ') else flag = true
    $out.append $('<a href="#"/>').text(author).click(facetHandler self, 'author_s', author)

  return $out

getYear = (self, facetHandler, year) ->
  $('<a href="#"/>').text(year).click(facetHandler self, 'pubyear_i', "[{year} TO {year}]")


# Copy of facetHandler; this is not ideal bit it should be a temporary
# addition, as the display of authors is going to change to match
# the author list of a publication.

facetHandler2 = (self, facet_field, facet_value) ->
  () ->
    self.manager.store.remove 'fq'
    self.manager.store.addByValue 'fq',
      "#{facet_field}:#{AjaxSolr.Parameter.escapeValue facet_value}"
    self.manager.doRequest 0
    return false

AjaxSolr.ResultWidget = AjaxSolr.AbstractWidget.extend
  afterRequest: () ->
    self = this
    $(self.target).empty()

    docids = []
    for doc in self.manager.response.response.docs
      authors = getAuthors(self, facetHandler2, doc.author)
      year = getYear(self, facetHandler2, doc.pubyear_i)
      snippet = AjaxSolr.theme 'snippet', doc, authors, year
      title = AjaxSolr.theme 'title', doc
      pivot = AjaxSolr.theme 'pivot', doc, self.facetHandler('bibcode', doc.bibcode)
      $(self.target).append AjaxSolr.theme('result', doc, snippet, title, pivot, self)

      items = []
      gaga = self.facetLinks 'keywords_s', doc.keywords_s
      items.concat gaga
      # QUS: is the following theme call actually useful?
      AjaxSolr.theme 'list_items', "#links_#{doc.id}", gaga, "| "
      docids.push doc.id

    ##console.log "DOCIDS: #{docids}"

    # Identify those papers that have been saved

    $.getJSON "#{SITEPREFIX}/savedpubs", (data) ->
      if data.savedpubs isnt 'undefined'
        ##console.log "SAVEDPUBS: #{data.savedpubs}"
        for doc in docids
          if doc in data.savedpubs
            $("#savepub_#{doc}").hide()
            $("#delpub_#{doc}").show()

      else
        for doc in docids
          $("#savepub_#{doc}").hide()
          $("#delpub_#{doc}").hide() # should not be needed but just in case
          $("#data_#{doc}").hide() # is this needed?

      return true

  facetLinks: (facet_field, facet_values) ->
    if facet_values?
      (AjaxSolr.theme('facet_link', val, this.facetHandler(facet_field, val)) for val in facet_values)
    else
      []

  moreHandler: (doc) ->
    () ->
      $("#am_#{doc.id}").hide()
      $("#p_#{doc.id}").show()
      $("#al_#{doc.id}").show()
      return false

  lessHandler: (doc) ->
    () ->
      $("#am_#{doc.id}").show()
      $("#p_#{doc.id}").hide()
      $("#al_#{doc.id}").hide()
      return false

  saveHandler: (doc) ->
    () ->
      doIt = (data) ->
        if data.success is "defined"
          $("#savepub_#{doc.id}").hide()
          $("#delpub_#{doc.id}").show()
        return false
      payload = JSON.stringify
        savedpub: doc.id
        pubbibcode: doc.bibcode
        pubtitle: doc.title
      $.post "#{SITEPREFIX}/savepub", payload, doIt
      return false

  deleteHandler: (doc) ->
    () ->
      doIt = (data) ->
        if data.success is "defined"
          $("#savepub_#{doc.id}").show()
          $("#delpub_#{doc.id}").hide()
        return false
      payload = JSON.stringify pubid: doc.id
      $.post "#{SITEPREFIX}/deletepub", payload, doIt
      return false

  facetHandler: (facet_field, facet_value) ->
    self = this
    () ->
      self.manager.store.remove 'fq'
      self.manager.store.addByValue 'fq',
        "#{facet_field}:#{AjaxSolr.Parameter.escapeValue facet_value}"
      self.manager.doRequest 0
      return false

  beforeRequest: () ->
    $(this.target).html $('<img/>').attr('src', '/semantic2/alpha/static/images/ajax-loader.gif')
    return true

