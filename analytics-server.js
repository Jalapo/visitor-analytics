var SQL_auth = {
    host: "CHANGE_TO_SERVER_IP",
    user: "CHANGE_TO_SERVER_USERNAME",
    password: "CHANGE_TO_SERVER_PASSWORD_IF_EXISTS",
    database: "CHANGE_TO_DB"
};

var SQL_data = {
    columns: ['ip_addr', 'region', 'country'] // column names to store IP, State/Region, and Country
};
var API_KEY = 'ENTER_API_KEY_HERE';
var HOST_IP = '0.0.0.0'; // ip for node.js/express to listen on
var PORT = 8896; // port for node.js/express to listen on
var cacheLength = 10; // amount of IPs to cache before sending to SQL database



var mysql = require('mysql2');
var express = require('express');

var fs = require('fs');
var server = express();

var dataCache = []; // array for ip and location data before sending to sql server
var IPs = []; // array for IPs
var localIPList = ['localhost','::1','127.0.0.1','0.0.0.0'];



// On start, check for data cache in file, save to dataCache variable
// using openSync will confirm the availability of the .json file, and create it if it does not exist
()=>{let cacheFile = fs.openSync('./analytics-cache.json', 'w'); fs.closeSync(cacheFile);}
let cacheFileContent = fs.readFileSync("./analytics-cache.json");
dataCache = cacheFileContent!=''? JSON.parse(cacheFileContent): [];
    
// console.log(dataCache.length);



// Begin listening on port 8896
server.listen(PORT, HOST_IP, ()=>{console.log(`Visitor Analytics server running on ${PORT}`)});

//////////////////////////////////////////////
//////////////////////////////////////////////
// DISABLE 2 FOLLOWING LINES DURING PRODUCTION
// var cors = require('cors');
// server.use(cors());



// Gathers IP from HTTP requests and get IP location from ipdata API 
server.all("/api/sql", async (req,res)=>{
    // get ip address from request socket
    let ip = req.socket.remoteAddress;

    // get location from 'ipdata' API
    let loc = await getIPData( localIPList.includes(ip)? '' : ip ); // prevents sending local IPs to API

    // push ip and location into cache
    dataCache.push(loc);
    fs.writeFileSync('./analytics-cache.json', `${JSON.stringify(dataCache)}`, 'utf8');

    // store all visits in sql server after 'cacheLength' times (using 3 for dev)
    if (dataCache.length>=cacheLength) {
        storeVisits();
    }
    res.status(200).send();
});



// Use 'ipdata' API to analyze ip
async function getIPData(ip) {
    let resInit = {method:"GET",headers:{"Content-Type":'application/json'}};
    let res = await fetch(`https://api.ipdata.co/${ip}?api-key=${API_KEY}`, resInit);
    let data = await res.json();
    return {'ip': data.ip, 'region': data.region, 'country_code': data.country_code};
}



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
            console.log(`Insertting: [IP: '${data.ip}', Location: '${data.region}, ${data.country_code}']`);
            let cols = SQL_data.columns;
            sql.query(`INSERT INTO Visitors (${cols[0]}, ${cols[1]}, ${cols[2]}) VALUES ('${data.ip}', '${data.region}', '${data.country_code}')`);
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