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

var config = require("./config").config;
var SITEPREFIX = config.SITEPREFIX;
var STATICPREFIX = config.STATICPREFIX;
var SOLRHOST = config.SOLRHOST;
var SOLRURL = config.SOLRURL;
var SOLRPORT = config.SOLRPORT;
var ADSHOST = config.ADSHOST;
var ADSURL = config.ADSURL;

// Needed to check whether we get a string or an array
// of strings. Taken from
// http://stackoverflow.com/questions/1058427/how-to-detect-if-a-variable-is-an-array/1058457#1058457
//
var isArray = function (o) {
    return (o instanceof Array) ||
        (Object.prototype.toString.apply(o) === '[object Array]');
};


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


// A comment on saved times, used in both savePub and saveSearch.
//
// Approximate the save time as the time we process the request
// on the server, rather than when it was made (in case the user's
// clock is not set sensibly). 
//
// For now we save the UTC version of the time and provide no
// way to change this to something meaningful to the user.
//
// Alternatives include:
//
// *  the client could send the time as a string, including the
//    time zone, but this relies on their clock being okay
//
// *  the client can send in the local timezone info which can
//    then be used to format the server-side derived time
//    Not sure if can trust the time zone offset from the client
//    if can not trust the time itself. Calculating a useful display
//    string from the timezone offset is fiddly.
//

function saveSearch(jsonpayload, req, res, next) {
    console.log("savedsearchcookies", req.cookies, jsonpayload);
    var savetime = new Date().getTime();

    ifLoggedIn(req, res, function(loginid) {
	var jsonobj = JSON.parse(jsonpayload);
	var savedsearch = jsonobj.savedsearch;
	redis_client.get('email:' + loginid, function (err, email) {

	    // keep as a multi even though now a single addition
	    var margs = [["zadd", 'savedsearch:' + email, savetime, savedsearch]
			];
	    redis_client.multi(margs).exec(function (err, reply) {
		successfulRequest(res);
	    });
	});
    });

} // saveSearch

function savePub(jsonpayload, req, res, next) {
    console.log("savedpubcookies", req.cookies, jsonpayload);
    var savetime = new Date().getTime();

    ifLoggedIn(req, res, function (loginid) {
	var jsonobj = JSON.parse(jsonpayload);
	var savedpub = jsonobj.savedpub;
	var bibcode = jsonobj.pubbibcode;
	var title = jsonobj.pubtitle;

	redis_client.get('email:' + loginid, function (err, email) {
            console.log("REPLY", email);

	    // Moved to a per-user database for titles and bibcodes so that we can delete
	    // search information. Let's see how this goes compared to "global" values for the
	    // bibcodes and titles hash arrays.
	    //
	    // Should worry about failures here, but not for now.
	    //
	    var margs = [["hset", 'savedbibcodes:' + email, savedpub, bibcode],
			 ["hset", 'savedtitles:' + email, savedpub, title],
			 ["zadd", 'savedpub:' + email, savetime, savedpub]
			];
	    redis_client.multi(margs).exec(function (err, reply) {
		console.log("Saving publication: ", title);
		successfulRequest(res);
	    });
	});
    });

} // savePub

/*
 * get all the elements for the given key, stored
 * in a sorted list, and sent it to callback
 * as cb(err,values). If flag is true then the list is sorted in
 * ascending order of score (ie zrange rather than zrevrange)
 * otherwise descending order.
 */
function getSortedElements(flag, key, cb) {

    redis_client.zcard(key, function (err, nelem) {
	// could subtract 1 from nelem but it looks like
	// Redis stops at the end of the list
	if (flag) {
	    redis_client.zrange(key, 0, nelem, cb);
	} else {
	    redis_client.zrevrange(key, 0, nelem, cb);
	}
    });
}

function getSavedSearches(req, res, next) {

    ifLoggedIn(req, res, function(loginid) {
	redis_client.get('email:' + loginid, function (err, email) {
	    getSortedElements(true, 'savedsearch:' + email, function (err, searches) {
		console.log("GETSAVEDSEARCHESREPLY", searches, err);
		successfulRequest(res, { 'keyword': 'savedsearches', 'message': searches } );
            });
	});
    }, { 'keyword': 'savedsearches' });

}

/*
 * We only return the document ids here; for the full document info
 * see doSaved.
 */
  
function getSavedPubs(req, res, next) {
    // console.log("::::::::::getSavedPubsCookies", req.cookies);

    ifLoggedIn(req, res, function (loginid) {
	redis_client.get('email:' + loginid, function (err, email) {
	    getSortedElements(true, 'savedpub:' + email, function (err, searches) {
		console.log("GETSAVEDPUBSREPLY", searches, err);
		successfulRequest(res, { 'keyword': 'savedpubs', 'message': searches } );
            });
	});
    }, {'keyword': 'savedpubs'});

}

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

// Remove the list of searchids, associated with the given 
// user cookie, from Redis.
//
// At present we require that searchids not be empty; this may
// be changed.
//
function removeSearches(res, loginid, searchids) {
    if (searchids.length === 0) {
	console.log("Error: removeSearches called with empty searchids list; loginid=" + loginid);
	failedRequest(res);
    } else {
	redis_client.get('email:' + loginid, function (err, email) {
	    var margs = [];
	    var key = 'savedsearch:' + email
	    var i;
	    // with Redis v2.4 we will be able to delete multiple keys with a single
	    // zrem call.
	    for (i in searchids) {
		margs.push(["zrem", key, searchids[i]]);
	    }
	    redis_client.multi(margs).exec(function (err, reply) {
		console.log("Assumed we have removed " + searchids.length + " searches from user's saved search list");
		successfulRequest(res);
	    });
	});
    }

} // removeSearches

// Similar to removeSearches but removes publications.
//
function removeDocs(res, loginid, docids) {
    if (docids.length === 0) {
	console.log("Error: removeDocs called with empty docids list; loginid=" + loginid);
	failedRequest(res);
    } else {
	redis_client.get('email:' + loginid, function (err, email) {
	    var margs = [];
	    var pubkey = 'savedpub:' + email;
	    var titlekey = 'savedtitles:' + email;
	    var bibkey = 'savedbibcodes:' + email;
	    var i;
	    // In Redis 2.4 zrem and hdel can be sent multiple keys
	    for (i in docids) {
		var docid = docids[i];
		margs.push(["zrem", pubkey, docid]);
		margs.push(["hdel", titlekey, docid]);
		margs.push(["hdel", bibkey, docid]);
	    }
	    redis_client.multi(margs).exec(function (err, reply) {
		console.log("Assumed we have removed " + docids.length + " papers from user's saved publication list");
		successfulRequest(res);
	    });
	});
    }

} // removeDocs

// Create a function to delete a single search or publication
//   funcname is used to create a console log message of 'In ' + funcname
//     on entry to the function
//   idname is the name of the key used to identify the item to delete
//     in the JSON payload
//   delItems is the routine we call to delete multiple elements
//
function deleteItem(funcname, idname, delItems) {
    return function (jsonpayload, req, res, next) {
	console.log(">> In " + funcname);
	// console.log(">>   cookies = ", req.cookies);
	// console.log(">>   payload = ", jsonpayload);

	ifLoggedIn(req, res, function (loginid) {
	    var jsonobj = JSON.parse(jsonpayload);
	    var delid = jsonobj[idname];
	    console.log("logincookie:", loginid, " delete item:", delid);
	    
	    if (delid === undefined) {
		failedRequest(res);
	    } else {
		delItems(res, loginid, [delid]);
	    }
	});
    };

} // deleteItem

// Create a function to delete multiple search or publication items
//   funcname is used to create a console log message of 'In ' + funcname
//     on entry to the function
//   idname is the name of the key used to identify the items to delete
//     in the JSON payload
//   delItems is the routine we call to delete multiple elements
//
function deleteItems(funcname, idname, delItems) {
    return function (payload, req, res, next) {
	console.log(">> In " + funcname);
	//console.log(">>   cookies = ", req.cookies);
	//console.log(">>   payload = ", payload);

	ifLoggedIn(req, res, function (loginid) {
	    var terms = JSON.parse(payload);
	    var action = terms.action;
	    var delids = [];
	    if (isArray(terms[idname])) {
		delids = terms[idname];
	    } else {
		delids = [ terms[idname] ];
	    }
    
	    if (action === "delete" && delids.length > 0) {
		delItems(res, loginid, delids);
	    } else {
		failedRequest(res);
	    }
	});
    };

} // deleteItems

var deleteSearch   = deleteItem("deleteSearch", "searchid", removeSearches);
var deletePub      = deleteItem("deletePub",    "pubid",    removeDocs);

var deleteSearches = deleteItems("deleteSearches", "searchid", removeSearches);
var deletePubs     = deleteItems("deletePubs",     "pubid",    removeDocs);


function addToRedis(req, res, next) {
     console.log("::::::::::addToRedisCookies", req.cookies);
     postHandler(req, res, insertUser);
     //insertUser(logincookie, instring); 
}

function saveSearchToRedis(req, res, next) {
    postHandler(req, res, saveSearch);
}
function savePubToRedis(req, res, next) {
    postHandler(req, res, savePub);
}

function deletePubFromRedis(req, res, next) {
    postHandler(req, res, deletePub);
}
function deletePubsFromRedis(req, res, next) {
    postHandler(req, res, deletePubs);
}
function deleteSearchFromRedis(req, res, next) {
    postHandler(req, res, deleteSearch);
}
function deleteSearchesFromRedis(req, res, next) {
    postHandler(req, res, deleteSearches);
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
server.use(SITEPREFIX+'/savedsearches', getSavedSearches);
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

server.use(SITEPREFIX+'/savedpubs', getSavedPubs);

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
