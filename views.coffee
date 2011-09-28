###
Create the different views/pages for the application.
###

fs = require 'fs'
url = require 'url'
mustache = require 'mustache'
redis_client = require('redis').createClient()

# TODO: clean up use of configuration information
TDIR = __dirname + '/static/ajax-solr/templates/'
SITEPREFIX = '/semantic2/alpha'
STATICPREFIX = '/static'

getTemplate = (fname) -> fs.readFileSync("#{TDIR}#{fname}", 'utf-8')

maint = getTemplate 'template.html'
partials =
  pagehead: getTemplate 'pagehead.html'
  bodyhead: getTemplate 'bodyhead.html'
  bodyright: getTemplate 'bodyright.html'

globpartialsjson = JSON.stringify partials

bodybodypub    = getTemplate 'bodybody_publications.html'
bodybodyobsv   = getTemplate 'bodybody_observations.html'
# bodybodysearch = getTemplate 'bodybody_search.html'
bodybodysaved  = getTemplate 'bodybody_saved.html'

# Create the view.
#   name is for logging and should identify the view
#   view is the mustache template view
#   body is the templates for the bodybody key
#
doView = (name, body, view) ->
  return (req, res, next) ->
    console.log "== doView: name=#{name} url=#{req.url} referer=#{req.headers.referer} originalUrl=#{req.originalUrl}"
    camefrom = url.parse(req.url, true).query.camefrom
    console.log "== request from: #{camefrom}"

    # Add in current URL to the view
    # (could be conditional on presence of bodyhead)
    #
    view.bodyhead.current_url = req.url

    lpartials = JSON.parse globpartialsjson
    lpartials.bodybody = body

    res.writeHead 200, 'Content-Type': 'text/html; charset=UTF-8'
    res.end mustache.to_html(maint, view, lpartials)

doPublications = doView "Publications", bodybodypub,
  pagehead:
    pagetitle: 'Publications'
    pageclass: 'publications'
    haswidgets: true
    siteprefix: SITEPREFIX
    staticprefix: SITEPREFIX + STATICPREFIX

  bodyhead:
    isitchosenpublications: 'chosen'
    siteprefix: SITEPREFIX
    staticprefix: SITEPREFIX + STATICPREFIX

  bodybody:
    bodyright:
      siteprefix: SITEPREFIX
      staticprefix: SITEPREFIX + STATICPREFIX

doObservations = doView "Observations", bodybodyobsv,
  pagehead:
    pagetitle: 'Observations'
    pageclass: 'observations'
    haswidgets: true
    siteprefix: SITEPREFIX
    staticprefix: SITEPREFIX + STATICPREFIX

  bodyhead:
    isitchosenobservations: 'chosen'
    siteprefix: SITEPREFIX
    staticprefix: SITEPREFIX + STATICPREFIX

  bodybody:
    bodyright:
      siteprefix: SITEPREFIX
      staticprefix: SITEPREFIX + STATICPREFIX

#
# In pubsub branch a lot of this complication has been removed
# and hopefully it can just use the doView helper.
#

# Given a saved search, which looks something like
#  "fq=keywords_s%3A%22stars%20luminosity%20function%3Bmass%20function%22&fq=author_s%3A%22Stahl%2C%20O%22&fq=instruments_s%3AMAST%2FIUE%2FLWR&q=*%3A*"
# return a (hopefully) human-readable version.
#
searchToText = (searchTerm) ->
  # lazy way to remove the trailing search term
  s = "&" + searchTerm
  s = s.replace '&q=*%3A*', ''

  # only decode after the initial split to protect against the
  # unlikely event that &fq= appears as part of a search term.
  terms = s.split /&fq=/

  # ignore the first entry as '' by construction
  terms.shift()
  toks = (decodeURIComponent(term).split(':', 2) for term in terms)
  return ("#{tok[0]}=#{tok[1]}" for tok in toks).join(' ')

# Returns a string representation of timeString, which
# should be a string containing the time in milliseconds,
# nowDate is the "current" date in milliseconds.
#
timeToText = (nowDate, timeString) ->
  t = parseInt timeString, 10
  delta = nowDate - t
  if delta < 1000
    return "Now"

  else if delta < 60000
    return "#{Math.floor(delta/1000)}s ago"

  else if delta < 60000 * 60
    m = Math.floor(delta / 60000)
    s = Math.floor((delta - m * 60000) /1000)
    out = "#{m}m"
    if s isnt 0
      out += " #{s}s"
    return "#{out} ago"

  else if delta < 60000 * 60 * 24
    h = Math.floor(delta / (60000 * 60))
    delta = delta - h * 60000 * 60
    m = Math.floor(delta / 60000)
    out = "#{h}h"
    if m isnt 0
      out += " #{m}m"
    return "#{out} ago"

  d = new Date(t)
  return d.toUTCString()

# Modify the object view to add in the needed Mustache template values
# given the search results.
#
createSavedSearchTemplates = (view, nowDate, searchkeys, searchtimes) ->
  nsearch = searchkeys.length
  if nsearch is 0
    view.hassearches = false
    view.savedsearches = []

  else
    view.hassearches = true

    makeTemplate = (ctr) ->
      key = searchkeys[ctr]
      time = searchtimes[ctr]
      out =
        searchuri: key
        searchtext: searchToText(key)
        searchime: time
        searchtimestr: timeToText nowDate, time
        searchctr: ctr
      return out

    view.savedsearches = (makeTemplate i for i in [0..nsearch-1])

  return true

createSavedPubTemplates = (view, nowDate, pubkeys, bibcodes, pubtitles, pubtimes) ->
  npub = pubkeys.length

  if npub is 0
    view.haspubs = false
    view.savedpubs = []

  else
    view.haspubs = true

    makeTemplate = (ctr) ->
      bibcode = bibcodes[ctr]
      linkuri = "bibcode%3A#{ bibcode.replace(/&/g, '%26') }"
      out =
        pubid: pubkeys[ctr]
        linktext: pubtitles[ctr]
        linkuri: linkuri
        pubtime: pubtimes[ctr]
        pubtimestr: timeToText nowDate, pubtimes[ctr]
        bibcode: bibcode
        pubctr: ctr
      return out

    view.savedpubs = (makeTemplate i for i in [0..npub-1])

  return true

# As getSortedElements but the values sent to the callback is
# a hash with two elements:
#    elements  - the elements
#    scores    - the scores
#
getSortedElementsAndScores = (flag, key, cb) ->
  redis_client.zcard key, (e1, nelem) ->
    n = nelem - 1
    if n is 0
      cb e1, elements: [], scores: []

    else
      splitIt = (err, values) ->
        # in case nelem has changed
        nval = 2 * values.length
        response =
          elements: (values[i] for i in [0..nval-1] by 2)
          scores:   (values[i] for i in [1..nval] by 2)

        cb err, response

      if flag
        redis_client.zrange key, 0, n, "withscores", splitIt
      else
        redis_client.zrevrange key, 0, n, "withscores", splitIt


doSaved = (req, res, next) ->
  console.log 'In do Saved'
  loginCookie = req.cookies.logincookie

  view =
    pagehead:
      pagetitle: 'Saved'
      pageclass: 'saved'
      haswidgets: false
      siteprefix: SITEPREFIX
      staticprefix: SITEPREFIX+STATICPREFIX

    bodyhead:
      isitchosensaved: 'chosen'
      current_url: req.url
      siteprefix: SITEPREFIX
      staticprefix: SITEPREFIX+STATICPREFIX

    bodybody:
      siteprefix: SITEPREFIX
      staticprefix: SITEPREFIX+STATICPREFIX

  lpartials = JSON.parse globpartialsjson
  lpartials.bodybody = bodybodysaved

  res.writeHead 200, 'Content-Type': 'text/html; charset=UTF-8'
  #console.log("loginCookie?=#{loginCookie?}")
  #console.log "loginCookie=#{loginCookie}"
  if not loginCookie?
    res.end mustache.to_html(maint, view, lpartials)
    return true

  nowDate = new Date().getTime()

  # I do not want to spend a lot of effort cleaning this up since it is all
  # going away as the logic is moving to the client
  # (see the pubsub branch for details).
  #
  doProc = (e1, email) ->
    #console.log "email:#{email}"
    getSortedElementsAndScores false, "savedsearch:#{email}", (e2, savedsearches) ->
      #console.log "e2=#{e2}"
      searchkeys = savedsearches.elements
      searchtimes = savedsearches.scores
      #console.log "keys=#{searchkeys}"
      createSavedSearchTemplates view, nowDate, searchkeys, searchtimes
      getSortedElementsAndScores false, "savedpub:#{email}", (e3, savedpubs) ->
        #console.log "e3=#{e3}"
        pubkeys = savedpubs.elements
        pubtimes = savedpubs.scores
        #console.log "pubkeys=#{pubkeys}"
        redis_client.hmget "savedtitles:#{email}", pubkeys, (e4, pubtitles) ->
          #console.log "e4=#{e4}"
          #console.log "pubtitles=#{pubtitles}"
          redis_client.hmget "savedbibcodes:#{email}", pubkeys, (e5, bibcodes) ->
            #console.log "e5=#{e5}"
            #console.log "pubtitles=#{bibcodes}"
            createSavedPubTemplates view, nowDate, pubkeys, bibcodes, pubtitles, pubtimes
            res.end mustache.to_html(maint, view, lpartials)

  #console.log "Looking for email via get email:#{loginCookie}"
  redis_client.get "email:#{loginCookie}", doProc
  return true

exports.doPublications = doPublications
exports.doObservations = doObservations
exports.doSaved = doSaved

