# User interface for the AstroExplorer.

Written in nodejs.

## Requires:

coffee-script
connect
connect-redis
hiredis
mime
mustache
redis
qs

Requires node > 0.4.8, Redis > 2.2.11, and a working solr connection.
All configs are currently in config.coffee

## CoffeeScript

Doug is currently re-writing the server in CoffeeScript; this means you
also need to convert the *.coffee files before running the server
(will package up at a later date to avoid this annoyance). 

### Server code

For the moment I have a simple shell script

    ./makecoffee

that converts all the *.coffee files in the current directory.

 - server2.js is created from server2.coffee and can be run via node

 - server.js is the original server code

### Client code

I have started to convert the client-side code to CoffeeScript to, but
have left the original JavaScript code in for reference/easy tracking
of changes in other branches. There is currently no version of the
makecoffee conversion script for the client-side code.

The client code is placed in

    static/ajax-solr/coffee/

and the static/ajax-solr/templates/pagehead.html template has been
updated to use a Mustache template called jsdir to locate the
JavaScript for the page views.

### Conversion notes

A couple of items I have noted whilst converting from JavaScript to CoffeeScript;
these are not (necessarily) deficiencies in the language:

- beware tabs when working on a copy of the JS code, at least if you use an editor
  which allows you to set the display width to 2. I have had several cases where
  code was converted to JS but didn't run as expected because the extra indentation
  caused by the "hidden" tab characters lead to blocks of code 
  being closed prematurely by the CoffeeScript compiler, or the compiler complained
  about extra/missing indentation at a line which looked correct.

- although it is nice to be able to write "foo bar, bax" this can lead to confusion
  when you have chained code to convert like

    foo.bar.bax(bob).fred(john, function (billy) -> ...)

  We should try and come up with sensible guide lines in such situations; in my
  conversion I have switched between

    foo.bar foo(ringo, paul)
    foo.bar(foo ringo, paul)

  The distinction becomes more important with multiple parameters, or when
  inlining an anonymous function, such as

    foo.bar foo(ringo, paul), freddy, (star) ->
      blahblah()

  I have also spent time chasing down compilation errors because I have not fully-removed
  all the brackets, or had them indented correctly.

- a lot of code can be cleaned up with the comprehension support; just need to
  remember whether we are looping over an array

    for name in names

  versus an object

    for key, value of names

  and to use [0...names.length] for an explicit index loop.

- I have not taken advantage of the "OO" support in CoffeeScript, in particular
  the class syntax or the "fat" arrows. They could be used, but easier for now
  to keep as is.

- be careful what is returned from a function - in particular jQuery callbacks -
  since a direct translation of the code may end up returning the last block
  because you should have added an explicit return true/false/... statement.

