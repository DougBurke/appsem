/* A NodeJS server that statically serves javascript out, proxies solr requests,
 and handles authentication through the ADS */

"use strict"; // for testing in JSLint

var connect = require('connect');
var connectutils = connect.utils;
var http = require('http');
var url = require('url');
var mustache = require('mustache');
var fs = require('fs');
var redis_client = require("redis").createClient();
var RedisStore = require('connect-redis')(connect);
//var uuid = require('node-uuid');

var requests = require("./requests");
var completeRequest = requests.completeRequest;
var failedRequest = requests.failedRequest;
var successfulRequest = requests.successfulRequest;
var ifLoggedIn = requests.ifLoggedIn;
var postHandler = requests.postHandler;

var proxy = require("./proxy");
var doProxy = proxy.doProxy;
var doTransformedProxy = proxy.doTransformedProxy;

var user = require("./user");
var loginUser = user.loginUser;
var logoutUser = user.logoutUser;
var insertUser = user.insertUser;
var getUser = user.getUser;

var views = require("./views");
var doPublications = views.doPublications;
var doObservations = views.doObservations;
var doSaved = views.doSaved;

var saved = require("./saved");

var config = require("./config").config;
var SITEPREFIX = config.SITEPREFIX;
var STATICPREFIX = config.STATICPREFIX;
var SOLRHOST = config.SOLRHOST;
var SOLRURL = config.SOLRURL;
var SOLRPORT = config.SOLRPORT;
var ADSHOST = config.ADSHOST;
var ADSURL = config.ADSURL;

var solrrouter = connect(
    connect.router(function (app) {
	app.get('/select', function (req, res) {
            var solroptions = {
                host: SOLRHOST,
                path: SOLRURL + req.url,
                port: SOLRPORT
            };
            doProxy(solroptions, req, res);
	}); 
    })
);

function makeADSJSONPCall(req, res, next) {
    //Add logic if the appropriate cookie is not defined
    var jsonpcback = url.parse(req.url, true).query.callback;
    var adsoptions = {
        host:ADSHOST,
        path:ADSURL,
        headers:{Cookie: 'NASA_ADS_ID=' + req.cookies.nasa_ads_id}
    };
    //var stuff = undefined;
    var isfunc = function (instring) {
        return jsonpcback + '(' + instring + ')';
    };
    console.log(jsonpcback);
    doTransformedProxy(adsoptions, req, res, isfunc);
}

function addToRedis(req, res, next) {
     console.log("::::::::::addToRedisCookies", req.cookies);
     postHandler(req, res, insertUser);
     //insertUser(logincookie, instring); 
}

function saveSearchToRedis(req, res, next) {
    postHandler(req, res, saved.saveSearch);
}
function savePubToRedis(req, res, next) {
    postHandler(req, res, saved.savePub);
}

function deletePubFromRedis(req, res, next) {
    postHandler(req, res, saved.deletePub);
}
function deletePubsFromRedis(req, res, next) {
    postHandler(req, res, saved.deletePubs);
}
function deleteSearchFromRedis(req, res, next) {
    postHandler(req, res, saved.deleteSearch);
}
function deleteSearchesFromRedis(req, res, next) {
    postHandler(req, res, saved.deleteSearches);
}

// Proxy the call to ADS, setting up the NASA_ADS_ID cookie
//
function doADSProxyHandler(payload, req, res, next) {
    console.log(">> In doADSProxyHandler");
    console.log(">>   cookies = ", req.cookies);
    console.log(">>   payload = ", payload);

    ifLoggedIn(req, res, function (loginid) {
	var args = JSON.parse(payload);
	var urlpath = args.urlpath;

	console.log("Proxying request to adsabs " + urlpath);
	doProxy({host: ADSHOST, port: 80, path: urlpath,
		 headers: { 'Cookie': 'NASA_ADS_ID=' + req.cookies.nasa_ads_id }
		}, req, res);
    });

} // doADSProxyHandler

function doADSProxy(req, res, next) {
    postHandler(req, res, doADSProxyHandler);
}

// This is just temporary code:
//   could add in a timeout and message
function quickRedirect(newloc) {
    return function (req, res, next) {
	res.writeHead(302, "Redirect", {
	    // does this lose any cookies?
	    'Location': newloc
	});
	res.statusCode = 302;
	res.end();
    };
}

var explorouter = connect(
    connect.router(function (app) {
        app.get('/publications', doPublications);
        app.get('/saved', doSaved);
	app.get('/objects', quickRedirect('publications/'));
	app.get('/observations', doObservations);
	app.get('/proposals', quickRedirect('publications/'));
	app.get('/', quickRedirect('publications/'));
    })
);

/***
function cookieFunc(req, res, next) {
    console.log('\\\\\\\\\\\\\\COOKIES:',JSON.stringify(req.cookies));
    //res.end(JSON.stringify(req.cookies));
    next();
  }
***/

var server = connect.createServer();
//server.use(connect.logger());
server.use(connect.cookieParser());

//Not sure we need to use session middleware, more like login moddleware cookies.
//Especially since we dont seem to know how not to reextend the time for session cookies.
//thats prolly right behavior for session cookies since the more people use the more we wanna keep them on
//server.use(connect.session({ store: new RedisStore, secret: 'keyboard cat', cookie :{maxAge: 31536000000} }));
server.use(STATICPREFIX+'/', connect.static(__dirname + '/static/ajax-solr/'));
server.use(SITEPREFIX+'/solr/', solrrouter);
server.use(SITEPREFIX+'/explorer/', explorouter);
server.use(SITEPREFIX+'/adsjsonp', makeADSJSONPCall);
//using get to put into redis:BAD but just for testing
server.use(SITEPREFIX+'/addtoredis', addToRedis);
server.use(SITEPREFIX+'/getuser', getUser);
server.use(SITEPREFIX+'/logout', logoutUser);
server.use(SITEPREFIX+'/login', loginUser);
server.use(SITEPREFIX+'/savesearch', saveSearchToRedis);
server.use(SITEPREFIX+'/savedsearches', saved.getSavedSearches);
server.use(SITEPREFIX+'/savepub', savePubToRedis);

server.use(SITEPREFIX+'/deletesearch', deleteSearchFromRedis);
server.use(SITEPREFIX+'/deletesearches', deleteSearchesFromRedis);
server.use(SITEPREFIX+'/deletepub', deletePubFromRedis);
server.use(SITEPREFIX+'/deletepubs', deletePubsFromRedis);

// Used by the saved search page to provide functionality
// to the saved publications list. This is a hack to work
// around the same-origin policy.
//
server.use(SITEPREFIX+'/adsproxy', doADSProxy);

server.use(SITEPREFIX+'/savedpubs', saved.getSavedPubs);

// not sure of the best way to do this, but want to privide access to
// ajax-loader.gif and this way avoids hacking ResultWidget.2.0.js
//
server.use('/images', connect.static(__dirname + '/static/ajax-solr/images/'));

function runServer(port) {
    var now = new Date();
    var url = 'http://localhost:' + port + SITEPREFIX + '/explorer/publications/';
    console.log(now.toUTCString() + " - Starting server on", url);
    server.listen(port);
}

var migration = require('./migration2');
migration.validateRedis(redis_client, function () { runServer(3002); });

//http://adsabs.harvard.edu/cgi-bin/nph-manage_account?man_cmd=logout&man_url=http%3A//labs.adsabs.harvard.edu/ui/%3Frefresh%3D1eec2387-96cb-11e0-a591-842b2b65702a
