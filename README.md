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

