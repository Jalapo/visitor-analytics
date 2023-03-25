var SQL_auth = {
    host: "CHANGE_TO_SERVER_IP",
    user: "CHANGE_TO_SERVER_USERNAME",
    password: "CHANGE_TO_SERVER_PASSWORD_IF_EXISTS",
    database: "CHANGE_TO_DB"
};
var HOSTIP = '0.0.0.0'; // ip for node.js/express to listen on
var PORT = 8896; // port for node.js/express to listen on



var mysql = require('mysql2');
var express = require('express');
// var cors = require('cors'); // usually necessary in a local test env, but unsafe for production
var fs = require('fs');
var server = express();

var dataCache = []; // array for ip and location data before sending to sql server
var IPs = []; // array for IPs



// On start, check for data cache in file, save to dataCache variable
// using openSync will confirm the availability of the .json file, and create it if it does not exist
()=>{let cacheFile = fs.openSync('./analytics-cache.json', 'w'); fs.closeSync(cacheFile);}
dataCache = JSON.parse(fs.readFileSync("./analytics-cache.json"));
// console.log(dataCache.length);


// Begin listening on port 8896
server.listen(PORT, HOSTIP, ()=>{console.log(`Visitor Analytics server running on ${PORT}`)});
// server.use(cors()); // REMOVED FOR PRODUCTION



// Take 'POST' requests, extract ip from POSTS
server.post("/api/sql", (req,res)=>{
    // get ip address from request socket
    let ip = req.socket.remoteAddress;

    // get location from 'ipdata' API
    let loc = getIPData(ip);

    // push ip and location into cache
    dataCache.push({ip:ip, loc:loc});
    fs.writeFileSync('./analytics-cache.json', `${JSON.stringify(dataCache)}`, 'utf8');

    // store all visits in sql server after 10 entries
    if (dataCache.length>=3) {
        storeVisits();
    }
    res.status(200).send();
});

// Use 'ipdata' API to analyze ip
function getIPData(ip) {
    return 'Unspecified';
}
// store ipaddr and country/location in cache var and file cache


// Store cached ip's and locations in SQL server
function storeVisits() {
    // connect to database
    let sql = connectDB();
    sql.connect(function(err) {
        if (err) throw err;
        console.log("Connected");

        // push each value in dataCache to server
        console.log(dataCache.length);
        for (let i=0; i<dataCache.length; i++) {
            data = dataCache[i];
            // (k)ey = ip_addr, (v)alue = location
            console.log(`Insertting: [IP: '${data.ip}', Location: '${data.loc}']`);
            sql.query(`INSERT INTO Visitors (ip_addr, location) VALUES ('${data.ip}', '${data.loc}')`);
        }

        sql.end((err)=>{if (err) throw err; console.log("Disconnected")}); // end connection to db
        dataCache = []; // clear data from memory
        fs.writeFileSync('./analytics-cache.json', ''); // clear data from cache file
    });
}

// connect to database and return open connection
function connectDB() {
    // Connect to SQL server
    let sql = mysql.createConnection({
        host: SQL_auth.host,
        user: SQL_auth.user,
        password: SQL_auth.password,
        database: SQL_auth.database
    });
    return sql;
}

// START caching cache data
function testCache() {
    // create dummy data for cache array
    dataCache.push({ip:'192.168.0.104', loc: 'United States'});
    dataCache.push({ip:'208.168.0.108', loc: 'United States'});
    dataCache.push({ip:'32.104.22.196', loc: 'Canada'});
    
    // turn cache data into JSON string and write to file
    fs.writeFileSync('./analytics-cache.json', JSON.stringify(dataCache));
    
    // retrieve and parse cache data as a new array to test data persistence on storage
    let testCache = JSON.parse(fs.readFileSync('./analytics-cache.json'));
    // log results and clear dummy data
    console.log(testCache);
    // dataCache = [];
}
// END caching