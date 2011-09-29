###
Handles saved items - e.g. searches and publications - that involves
accessing information from Redis.
###

# NOTE: this gets simplified a lot in the pubsub branch, when much
# of the functionality is moved out to the client.

redis_client = require("redis").createClient()

requests = require("./requests")
failedRequest = requests.failedRequest
successfulRequest = requests.successfulRequest
ifLoggedIn = requests.ifLoggedIn

# A comment on saved times, used in both savePub and saveSearch.
#
# Approximate the save time as the time we process the request
# on the server, rather than when it was made (in case the user's
# clock is not set sensibly and it allows us to associate a time
# zone, even if it is our time zone and not the user's).
#
# For now we save the UTC version of the time and provide no
# way to change this to something meaningful to the user.
#
# Alternatives include:
#
# *  the client could send the time as a string, including the
#    time zone, but this relies on their clock being okay
#
# *  the client can send in the local timezone info which can
#    then be used to format the server-side derived time
#    Not sure if can trust the time zone offset from the client
#    if can not trust the time itself. Calculating a useful display
#    string from the timezone offset is fiddly.
#

saveSearch = (payload, req, res, next) ->
  console.log "In saveSearch: cookies=#{req.cookies} payload=#{payload}"
  saveTime = new Date().getTime()

  ifLoggedIn req, res, (loginid) ->
    jsonObj = JSON.parse payload
    savedSearch = jsonObj.savedsearch

    redis_client.get "email:#{loginid}", (err, email) ->
      # keep as a multi even though now a single addition
      margs = [['zadd', "savedsearch:#{email}", saveTime, savedSearch]]
      redis_client.multi(margs).exec (err2, reply) -> successfulRequest res

savePub = (payload, req, res, next) ->
  console.log "In savePub: cookies=#{req.cookies} payload=#{payload}"
  saveTime = new Date().getTime()

  ifLoggedIn req, res, (loginid) ->
    jsonObj = JSON.parse payload
    savedPub = jsonObj.savedpub
    bibCode = jsonObj.pubbibcode
    title = jsonObj.pubtitle

    redis_client.get "email:#{loginid}", (err, email) ->

      # Moved to a per-user database for titles and bibcodes so that
      # we can delete this information. I am thinking that this could
      # just be asked via AJAX requests of Solr by the client in the
      # pubsub branch so could be removed.
      #
      margs = [['hset', "savedbibcodes:#{email}", savedPub, bibCode],
               ['hset', "savedtitles:#{email}", savedPub, title],
               ['zadd', "savedpub:#{email}", saveTime, savedPub]]
      resid_client.multi(margs).exec (err2, reply) -> successfulRequest res


# Get all the elements for the given key, stored
# in a sorted list, and sent it to callback
# as cb(err,values). If flag is true then the list is sorted in
# ascending order of score (ie zrange rather than zrevrange)
# otherwise descending order.
#
getSortedElements = (flag, key, cb) ->
  redis_client.zcard key, (err, nelem) ->
    # Could ask for nelem-1 but Redis seems to ignore
    # overflow here
    if flag
      redis_client.zrange key, 0, nelem, cb
    else
      redis_client.zrevrange key, 0, nelem, cb

getSavedSearches = (req, res, next) ->
  kword = 'savedsearches'
  doIt = (loginid) ->
    redis_client.get "email:#{loginid}", (err, email) ->
      getSortedElements true, "savedsearch:#{email}", (err2, searches) ->
        console.log "getSavedSearches reply=#{searches} err=#{err2}"
        successfulRequest res,
          keyword: kword
          message: searches

  ifLoggedIn req, res, doIt, keyword: kword

# We only return the document ids here; for the full document info
# see doSaved.

getSavedPubs = (req, res, next) ->
  kword = 'savedpubs'
  dofunc = (loginid) ->
    redis_client.get "email:#{loginid}", (err, email) ->
      getSortedElements true, "savedpub:#{email}", (err2, searches) ->
        console.log "getSavedPubs reply=#{searches} err=#{err2}"
        successfulRequest res,
          keyword: kword
          message: searches

  ifLoggedIn req, res, doIt, keyword: kword

# Remove the list of searchids, associated with the given
# user cookie, from Redis.
#
# At present we require that searchids not be empty; this may
# be changed.

removeSearches = (res, loginid, searchids) ->
  if searchids.length is 0
    console.log "ERROR: removeSearches called with empty searchids list; loginid=#{loginid}"
    failedRequest res
    return

  redis_client.get "email:#{loginid}", (err, email) ->
    key = "savedsearch:#{email}"
    # with Redis v2.4 we will be able to delete multiple keys with
    # a single zrem call
    margs = (['zrem', key, sid] for sid in searchids)
    redis_client.multi(margs).exec (err2, reply) ->
      console.log "Removed #{searchids.length} searches"
      successfulRequest res

# Similar to removeSearches but removes publications.

removeDocs = (res, loginid, docids) ->
  if docids.length is 0
    console.log "ERROR: removeDocs called with empty docids list; loginid=#{loginid}"
    failedRequest res
    return

  redis_client.get "email:#{loginid}", (err, email) ->
    pubkey = "savedpub:#{email}"
    titlekey = "savedtitles:#{email}"
    bibkey = "savedbibcodes:#{email}"

    # In Redis 2.4 zrem and hdel can be sent multiple keys
    margs1 = (['zrem', pubkey, docid] for docid in docids)
    margs2 = (['hdel', titlekey, docid] for docid in docids)
    margs3 = (['hdel', bibkey, docid] for docid in docids)
    margs = margs1.concat margs2, margs2
    redis_client.multi(margs).exec (err2, reply) ->
      console.log "Removed #{docids.length} searches"
      successfulRequest res


# Create a function to delete a single search or publication
#   funcname is used to create a console log message of 'In ' + funcname
#     on entry to the function
#   idname is the name of the key used to identify the item to delete
#     in the JSON payload
#   delItems is the routine we call to delete multiple elements

deleteItem = (funcname, idname, delItems) ->
  return (payload, req, res, next) ->
    console.log ">> In #{funcname}"
    ifLoggedIn req, res, (loginid) ->
      jsonObj = JSON.parse payload
      delid = jsonObj[idname]
      console.log "deleteItem: logincookie=#{loginid} item=#{delid}"
      if delid?
        delItems res, loginid, [delid]
      else
        failedRequest res

# Needed to check whether we get a string or an array
# of strings. Taken from
# http://stackoverflow.com/questions/1058427/how-to-detect-if-a-variable-is-an-array/1058457#1058457
#
# Is there a more CoffeeScript way of doing this (aside from a basic translation
# to CoffeeScript)

isArray = `function (o) {
    return (o instanceof Array) ||
        (Object.prototype.toString.apply(o) === '[object Array]');
};`

# Create a function to delete multiple search or publication items
#   funcname is used to create a console log message of 'In ' + funcname
#     on entry to the function
#   idname is the name of the key used to identify the items to delete
#     in the JSON payload
#   delItems is the routine we call to delete multiple elements

deleteItems = (funcname, idname, delItems) ->
    return (payload, req, res, next) ->
      console.log ">> In #{funcname}"
      ifLoggedIn req, res, (loginid) ->
        terms = JSON.parse payload
        action = terms.action
        delids = if isArray terms[idname] then terms[idname] else [terms[idname]]

        if action is "delete" and delids.length > 0
          delItems res, loginid, delids
        else
          failedRequest res

exports.deleteSearch   = deleteItem "deleteSearch", "searchid", removeSearches
exports.deletePub      = deleteItem "deletePub",    "pubid",    removeDocs

exports.deleteSearches = deleteItems "deleteSearches", "searchid", removeSearches
exports.deletePubs     = deleteItems "deletePubs",     "pubid",    removeDocs

exports.saveSearch = saveSearch
exports.savePub = savePub
exports.getSavedSearches = getSavedSearches
exports.getSavedPubs = getSavedPubs
