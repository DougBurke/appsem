###
Break out the request-handling code from server.js as
we rewrite in CoffeeScript.
###

###
Actually create and finish the request. The options argument
controls the choice of arguments and defoptions gives the default
values. The current approach is probably too flexible for its
needs but not flexible enough for expanded use.

The return message is sent using the keyword value set
to the message value.
###

completeRequest = (res, options, defoptions) ->
  opts = {}
  out = {}
  omsg = ""

  for key in defoptions
    opts[key] = if key in options then options[key] else defoptions[key]

  res.writeHead 200, "OK", 'Content-Type': 'application/json'
  out[opts.keyword] = opts.message
  omsg = JSON.stringify out
  console.log "Returning: #{omsg}"
  res.end omsg


###
The request failed so send back our generic "you failed" JSON
payload.

The options argument is used to set the name and value
of the value returned;
     keyword, defaults to 'success'
     message, defaults to 'undefined'
###

failedRequest = (res, options = {}) ->
  completeRequest res, options,
    keyword: 'success'
    message: 'undefined'

###
The request succeeded.

The options argument is used to set the name and value
of the value returned;
     keyword, defaults to 'success'
     message, defaults to 'defined'
###

successfulRequest = (res, options = {}) ->
  completeRequest res, options,
    keyword: 'success'
    message: 'defined'

exports.completeRequest = completeRequest
exports.failedRequest = failedRequest
exports.successfulRequest = successfulRequest
