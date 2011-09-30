# Theme for publications page

$ = jQuery

# TODO: think about sending Manager around explicitly
root = exports ? this
Manager = root.Manager

fancyboxOpts =
  autoDimensions: false
  width: 1024
  height: 768

AjaxSolr.theme.prototype.result = (doc, snippet, thetitlelink, thepivot, thedoc) ->
  $morea = $('<a href="#" class="less" id="am_'+doc.id+'">more</a>')
    .click(thedoc.moreHandler(doc))
  $lessa = $('<a href="#" id="al_'+doc.id+'" style="display:none">less</a>')
    .click(thedoc.lessHandler(doc))
  $bookmark = $('<a href="#" class="save" id="savepub_'+doc.id+'">save</a>')
    .click(thedoc.saveHandler(doc))
  $unbookmark = $('<a href="#" class="delete" id="delpub_'+doc.id+'" style="display:none">delete</a>')
    .click(thedoc.deleteHandler(doc))

  $('<div class="publication"/>')
    .append($('<h2/>').append("#{doc.title} ").append(thetitlelink).append(thepivot))
    .append($('<div class="bookmarks"/>'))
    .append($('<p class="links"/>').attr('id', "links_#{doc.id}"))
    .append('<p id="links_' + doc.id + '" class="links"></p>')
    .append(snippet[0])
    .append(snippet[1]
      .attr('class', 'extrapaperinfo')
      .attr('id', "p_#{doc.id}"))
    .append($('<div class="lessmore"></div>').append($bookmark).append($unbookmark).append($morea).append($lessa))

AjaxSolr.theme.prototype.title = (doc) ->
  $('<a class="iframe"/>').text('(Link)')
    .attr('href', "http://labs.adsabs.harvard.edu/ui/abs/#{doc.bibcode}")
    .fancybox(fancyboxOpts)

# for now have pivot that requires a doc argument (unused) and
# pivot_link that doesn't.
AjaxSolr.theme.prototype.pivot = (doc, handler) -> $('<a href="#"/>').text(' [P]').click(handler)
AjaxSolr.theme.prototype.pivot_link = (handler) -> $('<a href="#"/>').text(' [P]').click(handler)

AjaxSolr.theme.prototype.facet_link = (value, handler) -> $('<a href="#"/>').text(value).click(handler)

getSimbadURI = (ele) ->
  "http://simbad.u-strasbg.fr/simbad/sim-id?Ident=#{encodeURIComponent(ele)}&NbIdent=1&Radius=2&Radius.unit=arcmin&submit=submit+id"

makeSimbadLink = (ele) ->
  $('<a class="iframe"/>')
    .text(ele)
    .attr('href', getSimbadURI(ele))
    .fancybox(fancyboxOpts)

# Need mission specific info to determine what to link to here

getChandraObsidlink = (label, link) ->
  link ?= label
  $('<a class="iframe"/>')
    .text(label)
    .attr('href', "http://cda.harvard.edu/chaser/ocatList.do?obsid=#{link}")
    .fancybox(fancyboxOpts)

getMASTObsidlink = (mission, label, link) ->
  link ?= label
  $('<a class="iframe"/>')
    .text(label)
    .attr('href', "http://archive.stsci.edu/cgi-bin/mastpreview?mission=#{mission}&dataid=#{link}")
    .fancybox(fancyboxOpts)

obslinks =
  CHANDRA: getChandraObsidlink

  euve: (obsid) -> getMASTObsidlink('euve', obsid)
  fuse: (obsid) -> getMASTObsidlink('fuse', obsid)
  hpol: (obsid) -> getMASTObsidlink('hpol', obsid, obsid.slice(8, obsid.length-3))
  hut:  (obsid) -> getMASTObsidlink('hut',  obsid, obsid.split('=')[0])
  iue:  (obsid) -> getMASTObsidlink('iue',  obsid, obsid.slice(0, obsid.length-4))
  wuppe: (obsid) -> getMASTObsidlink('wuppe', obsid)

getObslink = (mission, obsid) ->
  if obslinks[mission]?
    obslinks[mission](obsid)
  else
    alert "Internal error: no idea how to get link to mission=#{mission} obsid=#{obsid}"

pubLabel = (label) -> $('<span class="pubitem"/>').text(label)

makePivotHandler = (pivot) ->
  () ->
    # using global Manager here
    Manager.store.remove 'fq'
    Manager.store.addByValue 'fq', pivot
    Manager.doRequest 0
    return false

makePivotLink = (pivot) -> AjaxSolr.theme('pivot_link', makePivotHandler pivot)

addObjectArea = (parentarea, docid, objnames, objtypes) ->
  if not objnames?
    return

  # We want a sorted list here. We could come up with a sort
  # function to handle sorting "M80" and "M81" but for now
  # live with the current system.
  objinfo = ({name: objnames[i], objtype: objtypes[i]} for i in [0...objnames.length])
  objinfo.sort (a,b) -> a.name.localeCompare(b.name)

  $otable = $('<table class="tablesorter"/>')
    .attr('id', "objs_#{docid}")
    .append($('<thead/>')
      .append('<tr><th>Name</th><th>Type</th></tr>'))

  $obody = $('<tbody/>');
  for {name, objtype} in objinfo
    $obody.append($('<tr/>')
      .append($('<td/>')
        .append(makeSimbadLink name)
        .append(makePivotLink "objectnames_s:#{AjaxSolr.Parameter.escapeValue name}"))
      .append($('<td/>')
        .text(objtype)
        .append(makePivotLink "objecttypes_s:#{AjaxSolr.Parameter.escapeValue objtype}"))
        )

  $otable.append $obody
  parentarea
    .append($('<div class="objectdataarea"/>')
      .append(pubLabel "Objects:")
      .append(' ')
      .append($otable))
    .append($('<br/>'))

  # as with the data area, this should only be needed when the table
	# is actually viewed.
  $otable.tablesorter()

# sort on exposure length, but we want largest first
compareObs = (a, b) ->
  va = a.exptime
  vb = b.exptime
  if va > vb
    -1
  else if va < vb
    1
  else
    0

# Create the data area for this publication. Some code could probably be
# cleaned up by processing based on the name of the "mission parent" - e.g.
# we encode target names as 'MAST/foo' and 'CHANDRA/bar' and so we could
# use 'MAST' to possibly simplify some logic below
#
addDataArea = (parentarea, docid, bibcode, obsids, exptimes, expdates, targets, ras, decs) ->
  if not obsids?
    return

  $dataarea = $('<div class="missiondataarea"/>')
    .append(pubLabel 'Datasets:')
    .append(' ')

  # Combine the data, as well as cleaning up the obsid value
  missionmap = {}
  for i in [0...obsids.length]
    [mission, obsid] = obsids[i].split '/'
    out =
      mission: mission
      obsid: obsid
      exptime: exptimes[i]
      obsdate: expdates[i]
      target: targets[i].split('/', 2)[1]
      ra: ras[i]
      dec: decs[i]

    if missionmap[mission]?
      missionmap[mission].push out
    else
      missionmap[mission] = [out]

  # Ensure the mission data is sorted; we want the data
  # sorted by exposure time within each mission rather
  # than an overall sort on exposure (as would be provided
  # by tablesorter).
  missions = []
  for mission, vals of missionmap
    vals.sort compareObs
    missions.push mission

  missions.sort()
  nmissions = missions.length
  mastmissions = (m for m in missions if m isnt "CHANDRA")

  # Display any 'download all data' links
  #  - multiple chandra
  #  - multiple MAST
  #
  # At present we only support "all MAST", not
  # per mission within MAST.

  if missionmap.CHANDRA?
    nm = missionmap.CHANDRA.length
    if nm isnt 1
      mobsids = (e.obsid for e in missionmap.CHANDRA)
      $dataarea
        .append(getChandraObsidlink "All CHANDRA (#{nm})", mobsids.join(','))
        .append(' ')

  nmast = mastmissions.length
  if nmast > 1 or (nmast == 1 and missionmap[mastmissions[0]].length > 1)
    mnames = ("#{ms.length} #{m}" for m,ms of missionmap)
    $dataarea.append(
      $('<a class="iframe"/>')
        .text("All MAST (#{mnames.join ','})")
        .attr('href', "http://archive.stsci.edu/mastbibref.php?bibcode=#{encodeURIComponent(bibcode)}")
        .fancybox(fancyboxOpts)
      )

  # Now the data table containing all the missions. We could split out into mission-specific
  # tables but leave as a single one for now.
  #
  # Could add more rows and clean up or remove the # column

  colnames = ["Mission", "Observation", "Exposure time (s)",
    "Observation date", "Target name", "RA", "Dec"]

  $mtable = $('<table class="tablesorter"/>')
    .attr('id', "obsdata_#{docid}")
    .append($('<thead/>')
      .append($('<tr/>')
        .append(("<th>#{c}</th>" for c in colnames).join(''))))

  $mbody = $('<tbody/>')
  for mission in missions
    mvalues = missionmap[mission]
    mitems = mvalues.length

    # hacky; currently used to create the target-name pivot
    parent = if mission is 'CHANDRA' then 'CHANDRA' else 'MAST'

    for idx in [0...mitems]
      ctr = idx + 1
      {obsid, exptime, obsdate, target, ra, dec} = mvalues[idx]

      obsidpivot = "osbdis_s:#{AjaxSolr.Parameter.escapeValue mission + '/' + obsid}"

      $mbody.append($('<tr/>')
        .append($('<td/>').text mission.toUpperCase())
        .append($('<td/>')
          .append(getObslink mission, obsid)
          .append(makePivotLink obsidpivot))
        .append($('<td/>').text exptime)
        .append($('<td/>').text obsdate)
        .append($('<td/>')
          .text(target)
          .append(makePivotLink('targets_s:' + AjaxSolr.Parameter.escapeValue(parent + '/' + mvalues[idx].target))))
        .append($('<td/>').text ra) # may want to try <span value=decimal>text value</span> trick?
        .append($('<td/>').text dec))

  # Ensure we can sort the table; the tablesorter call *could* be made
  # when the 'more' link is activated by the user (as an optimisation for the
  # case when multiple tables are being created but none actually viewed
  # by the user), but worry about that only if profiling shows it is an
  # actual issue.

  $mtable.append $mbody
  $mtable.tablesorter()
  $dataarea.append $mtable
  parentarea
    .append($dataarea)
    .append($('<br/>'))

# TODO: for some reason year is now being sent in as an object rather than
# a value (conversion to CoffeeScript).
#
# so replacing by the original value of doc.pubyear_i; why did we
# want the year sent in separately anyway?
#
AjaxSolr.theme.prototype.snippet = (doc, authors, year) ->
  $output1 = $('<p/>')
    .append(pubLabel 'Authors:')
    .append(' ')
    .append(authors)
    .append('<br/>')
    .append(pubLabel 'Year:')
    # .append(" #{year} ") # this is an object
    .append(" #{doc.pubyear_i} ") # why did we move away from this in the first place?
    .append(pubLabel 'BibCode:' )
    .append(" #{doc.bibcode} ")
    .append(pubLabel 'Citations:')
    .append(" #{doc.citationcount_i}")

  $output2 = $('<div/>')
  addObjectArea $output2, doc.id, doc.objectnames_s, doc.objecttypes_s
  addDataArea $output2, doc.id, doc.bibcode,
    doc.obsids_s, doc.exptime_f, doc.obsvtime_d, doc.targets_s, doc.ra_f, doc.dec_f

  # do we need to HTML escape this text?
  $abstract = $('<div class="abstracttext"><span class="pubitem">Abstract:</span> '+doc.abstract+'</div>')
  $output2.append $abstract
  [$output1, $output2]

AjaxSolr.theme.prototype.tag = (value, thecount, weight, handler, handler2) ->
  $thelink = $('<a href="#"/>').text(value).click(handler)
  $thetext = $('<span/>').text "(#{thecount})"
  $('<span class="tagcloud_item"/>')
    .addClass("tagcloud_size_#{weight}")
    .append('[')
    .append($thelink)
    .append($thetext)
    .append(']')

AjaxSolr.theme.prototype.no_items_found = () -> 'No items found in current selection'

AjaxSolr.theme.prototype.list_items = (list, items, separator) ->
  $list = $(list)
  $list.empty()

  iflag = true
  for item in items
    li = $('<li/>')
    if AjaxSolr.isArray item

      jflag = true
      for it in item
        if separator
          if jflag then jflag = false else li.append separator
        li.append it

    else
      if separator
        if iflag then iflag = false else li.append separator
      li.append item

    $list.append li

