User interface for the AstroExplorer.

Written in nodejs.

Requires:
coffee-script
connect
connect-redis
hiredis
mime
mustache
redis
qs

Requires node > 0.4.8, Redis > 2.2.11, and a working solr connection.
All configs are currently in server.js

Doug is currently re-writing the server in CoffeeScript; this means you
also need to convert the *.coffee files before running the server
(will package up at a later date to avoid this annoyance).
