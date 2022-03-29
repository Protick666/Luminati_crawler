'use strict';

var async = require('async');
var _ = require('lodash');

// export NODE_OPTIONS=--max_old_space_size=16384
// lum config
var username = 'lum-customer-c_9c799542-zone-protick';
var password = 'cbp4uaamzwpy';
var port = 22225;

// TODO
const fs = require('fs');
//let rawdata = fs.readFileSync('/home/protick/ocsp_dns_django/ttl_data_set-live-False.json');
let rawdata = fs.readFileSync('/Users/protick.bhowmick/PriyoRepos/OCSP_DNS_DJANGO/ttl_data_set-live-True.json');

const URL = 'ttlexp.exp.net-measurement.net'

let asn_instance_list = JSON.parse(rawdata);

const ALLOWED_TIME_IN_MINUTES = 2
let trials = 0
let async_count = 0
let async_error_count = 0
let final_error_count = 0
let syn_count = 0
// console.log(domains.length); // 18,021
// console.log(domains);
// npm install request-promise --save
var request = require('request-promise');
const {v4: uuidv4} = require("uuid");
//const needle = require("./needle");
var needle = require('needle');

async function asnLookup(domain, executed) {
    //
    //console.log("querying..: " + domain);
    try {
        //trials += 1;
        var session_id = (1000000 * Math.random()) | 0;
        var query_url = `http://${session_id}.${URL}`;
        var super_proxy = 'http://' + username + '-asn-' + domain.asn + '-session-' + session_id + ':' + password + '@zproxy.lum-superproxy.io:' + port;

        needle.get(query_url, { proxy: super_proxy }, function(err, resp, body) {
            // request passed through proxy
            if (err) {
                executed(err, domain.id);
            }
            else {
                if (body.includes("Error")) {
                    executed("Error", domain.id);
                }
                else {
                    executed(null, domain.id);
                }

            }

        });

        //var request = require('request-promise');


        // let a = String(Date.now());
        // let uuid_str = uuidv4() + a;
        // let req_url = `http://${uuid_str}.${exp_id}.${domain.asn}.${URL}`

        // var options = {
        //     url: query_url,
        //     proxy: super_proxy
        // };
        // request(options)
        //     .then(function(data){
        //
        //             executed(null, domain.id);
        //         },
        //         function(err){
        //             executed(err, domain.id);
        //         });

    } catch (e) {
        executed(e, domain.id);
        final_error_count += 1
    }

    // try {
    //     trials += 1
    //
    //     var session_id = (1000000 * Math.random()) | 0;
    //     var query_url = `http://${session_id}.${URL}`;
    //     var options = {
    //         auth: {
    //             username: username + '-session-' + session_id + '-asn-' + domain.asn,
    //             password
    //         },
    //         host: 'zproxy.lum-superproxy.io',
    //         port
    //     };
    //
    //     await require('axios-https-proxy-fix').get(query_url, options)
    //         .then(function (data) {
    //                 //console.log(data.data);
    //                 executed(null, domain.id);
    //                 async_count += 1;
    //             },
    //             function (err) {
    //                 async_error_count += 1;
    //                 console.error(err);
    //                 executed("Error", domain.id);
    //             });
    //
    //
    //     //callback();
    // } catch (e) {
    //     //console.log('err' + e);
    //     final_error_count += 1
    //     executed("Error", domain.id);
    //     // cargo.push(domain);
    //     //callback("Error");
    // }
};

// var cargoQueue = async.cargoQueue(function(tasks, callback) {
//     for (var i=0; i<tasks.length; i++) {
//         asnLookup(tasks[i])
//     }
//     callback();
// }, 100);

// _.each(domains, function(task){
//     //console.log(task)
//     let d = {asn: task[0], id: task[1]}
//     cargoQueue.push(d, function(err) {
//         console.log('finished processing' + task[1]);
//     });
// });

// cargo.drain(function() {
//     console.log('all items have been processed');
//     setTimeout(function() {
//         console.log("Socket closed");
//         fs.open('/home/ashiq/tempFolder/CA_naming.txt', 'w', function (err, file) {});
//         socket.destroy();
//         process.exit();
//     }, 20000);
// });


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function get_chunk(perChunk, inputArray) {

    let result = inputArray.reduce((resultArray, item, index) => {
        const chunkIndex = Math.floor(index / perChunk)

        if (!resultArray[chunkIndex]) {
            resultArray[chunkIndex] = [] // start a new chunk
        }

        resultArray[chunkIndex].push(item)

        return resultArray
    }, [])

    return result
}

async function main(CHUNK_SIZE) {
    let it = 1

    const init = Date.now()

    const asn_instance_list_shuffled = asn_instance_list.sort((a, b) => 0.5 - Math.random());

    let chunks = get_chunk(CHUNK_SIZE, asn_instance_list_shuffled)

    let a = 1
    for (let step = 0; step < chunks.length; step++) {
        // Runs 5 times, with values of step 0 through 4.
        //console.log('Starting iteration ' + step);

        let chunk = chunks[step]

        // var cargoQueue = async.cargo(async function (tasks, callback) {
        //     for (var i = 0; i < tasks.length; i++) {
        //         await asnLookup(tasks[i])
        //     }
        //     callback();
        // }, CHUNK_SIZE);

        var cargoQueue = async.queue((task, executed) => {
            asnLookup(task, executed)

        }, CHUNK_SIZE); // concurrency value = 1

        syn_count = syn_count + chunk.length;

        _.each(chunk, function (task) {
            //console.log(task)
            let d = {asn: task[0], id: task[1]}
            // cargoQueue.push(d, function (err) {
            //     //console.log('finished processing' + task[1]);
            // });

            cargoQueue.push(d, (error, task) => {
                if (error) {
                    console.log(`An error occurred while processing task ${task}`);
                } else {
                    //console.log(`Finished processing task ${task}`);
                }
            });
        });

        cargoQueue.drain(() => {
            console.log('All items are succesfully processed !');
        })

        await cargoQueue.drain()

        // cargoQueue.drain(function () {
        //     //console.log('all items have been processed for iteration' + step);
        // });

        let time_now = Date.now()
        let minutes_taken_till_now = (time_now - init) / 60000;

        //console.log("Time till now interation" + minutes_taken_till_now)
        if (minutes_taken_till_now > ALLOWED_TIME_IN_MINUTES) {
            break;
        }
        await sleep(500);
    }

    let final_time = Date.now()
    let total_minutes_taken_till_now = (final_time - init) / 60000;

    console.log("*************************************************")
    console.log("Chunk" + CHUNK_SIZE)
    console.log("Time" + total_minutes_taken_till_now)
    console.log("Sync count" + syn_count)
    console.log("Trials count" + trials)
    console.log("Async count" + async_count)
    console.log("Async error count" + async_error_count)
    console.log("Async outer error count" + final_error_count)
    console.log("Total count" + asn_instance_list_shuffled.length)
    console.log("*************************************************")
}

async function init() {
    for (let i = 100; i < 1500; i = i + 200) {
        async_count = 0;
        async_error_count = 0;
        syn_count = 0;
        final_error_count = 0;
        trials = 0;

        await main(i);
    }
}

init()