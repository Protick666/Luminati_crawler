'use strict';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
var async = require('async');
var _ = require('lodash');
var axios = require('axios');
require('log-timestamp');
const fs = require('fs');
const {v4 : uuidv4} = require('uuid');
const { Telegraf } = require('telegraf')
// live_node_30_1
const EXP_ID_CURRENT = "live_node_30_1"

const app = new Telegraf("5218575778:AAGjs0CStM2A8mmQ1Jr_LtmuIOo_7kP-_Dw");

// const read_path = '/Users/protick.bhowmick/PriyoRepos/OCSP_DNS_DJANGO/ttl_data_set-live-True.json'
const read_path = '/home/protick/ocsp_dns_django/ttl_data_set-live-False.json'

// export NODE_OPTIONS=--max_old_space_size=16384
// lum config
var username = 'lum-customer-c_9c799542-zone-protick-dns-remote';
var password = 'cbp4uaamzwpy';
var port = 22225;
const URL = 'ttlexp.exp.net-measurement.net'

// TWEAK -->
const ALLOWED_TIME_IN_MINUTES = 10
const COOL_DOWN_IN_MINUTES = 30
const CHUNK_SIZE = 500

let trials = 0
let async_count = 0
let async_error_count = 0
let final_error_count = 0
let syn_count = 0
let phase_one_list = []
let phase_one_dict = {}

let final_count_matched = 0

// var request = require('request-promise');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function send_telegram_message(message) {
    app.telegram.sendMessage(1764697018, message);
    console.log(message)
}

function shuffle(array) {
    let counter = array.length;

    // While there are elements in the array
    while (counter > 0) {
        // Pick a random index
        let index = Math.floor(Math.random() * counter);

        // Decrease counter by 1
        counter--;

        // And swap the last element with it
        let temp = array[counter];
        array[counter] = array[index];
        array[index] = temp;
    }

    return array;
}

function shuffle_init(array) {
    let helper = Array.from(Array(array.length).keys())
    helper = shuffle(helper)
    let ans = []
    for(let i = 0; i < array.length; i++) {
        ans.push(array[helper[i]])
    }
    return ans
}

async function change_bind_config(file_version, ttl) {
    let bind_url = "http://52.44.221.99:8000/update-bind";
    await axios.get(bind_url, { params: {'file_version': file_version, 'ttl': ttl} })
        .then(response => {
            console.log("Bind change " + file_version);
            //console.log(response.data);
        })
        .catch(error => {
            console.log(error);
            axios.get(bind_url, { params: {'file_version': file_version, 'ttl': ttl} })
                .then(response => {
                    console.log("Bind change " + file_version);
                })
                .catch(error => {
                    console.log(error);
                });
        });
}

async function interim_checks(exp_id, event_str) {
    let uuid_str = uuidv4()

    let req_url = `http://${uuid_str}.${exp_id}.${event_str}.${URL}`

    await axios.get(req_url)
        .then(response => {
            console.log("Interim check " + exp_id + " " + event_str);
            //console.log(response.data);
        })
        .catch(error => {
            console.log(error);
            axios.get(req_url)
                .then(response => {
                    console.log("Interim check " + exp_id + " " + event_str);
                    //console.log(response.data);
                })
                .catch(error => {
                    console.log(error);
                });
        });
}

function get_server(data) {
    if (data.body.includes("phase1")) {
        return 1;
    }
    else {
        return 2;
    }
}

function get_luminati_ip_hash(headers) {
    for(let i = 0; i < headers.length; i++) {
        if(headers[i] === 'x-luminati-ip') {
            return headers[i + 1];
        }
    }
    return "-1"
}

function store_phase1_data(domain, data, req_url) {
    let ip_hash = get_luminati_ip_hash(data.rawHeaders)
    let server = get_server(data)

    if( !(domain.id in phase_one_dict )) {
        phase_one_dict[domain.id] = {}
    }
    phase_one_dict[domain.id]['ip_hash'] = ip_hash
    phase_one_dict[domain.id]['asn'] = domain.asn
    phase_one_dict[domain.id]['req_url'] = req_url
    phase_one_dict[domain.id]['host-phase-1'] = server
    phase_one_dict[domain.id]['"1-time"'] = Date.now()
}

function store_phase2_data(domain, data, req_url) {
    let server = get_server(data)

    if( !(domain.id in phase_one_dict )) {
        return
    }
    phase_one_dict[domain.id]['host-phase-2'] = server
    phase_one_dict[domain.id]['"2-time"'] = Date.now()
    final_count_matched += 1
}

function get_prev_ip_hash(domain) {
    let a = 1;
    return phase_one_dict[domain.id]['ip_hash'];
}

function get_prev_url(domain) {
    return phase_one_dict[domain.id]['req_url']
}

async function asnLookup_phase_1(domain, exp_id, phase, executed) {

    try {
        //trials += 1;

        var request = require('request-promise');

        var luminati_session_id = (10000000 * Math.random()) | 0;
        var super_proxy = 'http://' + username + '-asn-' + domain.asn + '-session-' + luminati_session_id + ':' + password + '@zproxy.lum-superproxy.io:' + port;

        let a = String(Date.now());
        let uuid_str = uuidv4() + a;
        let req_url = `http://${uuid_str}.${exp_id}.${domain.asn}.${URL}`

        var options = {
            url: req_url,
            proxy: super_proxy,
            resolveWithFullResponse: true
        };
        request(options)
            .then(function(data){
                    phase_one_list.push(domain)
                    store_phase1_data(domain, data, req_url)
                    executed(null, domain.id);
                },
                function(err){
                    executed(err, domain.id);
                });

    } catch (e) {
        executed(e, domain.id);
        final_error_count += 1
    }
};


async function asnLookup_phase_2(domain, exp_id, phase, executed) {

    try {
        trials += 1;

        var request = require('request-promise');
        var luminati_session_id = (10000000 * Math.random()) | 0;

        let prev_ip_hash = get_prev_ip_hash(domain)
        let prev_url = get_prev_url(domain)

        var super_proxy = 'http://' + username + '-asn-' + domain.asn + '-ip-' + prev_ip_hash+ '-session-' + luminati_session_id + ':' + password + '@zproxy.lum-superproxy.io:' + port;
        let req_url = prev_url

        var options = {
            url: req_url,
            proxy: super_proxy,
            resolveWithFullResponse: true
        };
        request(options)
            .then(function(data){
                    store_phase2_data(domain, data, req_url)
                    executed(null, domain.id);
                },
                function(err){
                    executed(err, domain.id);
                });

    } catch (e) {
        executed(e, domain.id);
        final_error_count += 1
    }
};


function get_chunks(perChunk, inputArray) {

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

async function do_phase_one_two(asn_instance_list_shuffled, exp_id, phase) {

    const init = Date.now()
    let chunks = get_chunks(CHUNK_SIZE, asn_instance_list_shuffled)

    for (let step = 0; step < chunks.length; step++) {

        let chunk = chunks[step];
        var cargoQueue = null;

        if(phase === 1) {
            cargoQueue = async.queue((task, executed) => {
                asnLookup_phase_1(task, exp_id, 1, executed)

            }, CHUNK_SIZE);
        }
        else {
            cargoQueue = async.queue((task, executed) => {
                asnLookup_phase_2(task, exp_id,2, executed)

            }, CHUNK_SIZE);
        }

        _.each(chunk, function (task) {
            //console.log(task)
            let d = null;
            if(phase === 1) {
                d = {asn: task[0], id: task[1]}
            }
            else {
                d = {asn: task.asn, id: task.id}
            }

            cargoQueue.push(d, (error, task_id) => {
                if (error) {
                    console.log(`An error occurred while processing task ${task_id} ${error}`);
                } else {
                    console.log(`Phase ${phase} Finished processing task ${task_id}`);
                }
            });
        });

        cargoQueue.drain(() => {
            console.log('Phase ' + phase + ' All items are succesfully processed !');
        })

        await cargoQueue.drain()

        let time_now = Date.now()
        let minutes_taken_till_now = (time_now - init) / 60000;

        if (phase === 1) {
            if (minutes_taken_till_now > ALLOWED_TIME_IN_MINUTES) {
                break;
            }
        }
    }

    let final_time = Date.now()
    let total_minutes_taken_till_now = (final_time - init) / 60000;
    let msg_to_Send = "Time taken in phase " + phase + " " + total_minutes_taken_till_now
    console.log(msg_to_Send)
    send_telegram_message(msg_to_Send)
}


async function init(exp_id) {
    async_count = 0;
    async_error_count = 0;
    final_error_count = 0;
    trials = 0;
    let rawdata = fs.readFileSync(read_path);
    let asn_instance_list = JSON.parse(rawdata);
    // TODO check
    // const asn_instance_list_shuffled = asn_instance_list.sort((a, b) => 0.5 - Math.random());
    let asn_instance_list_shuffled = shuffle_init(asn_instance_list)
    send_telegram_message("Experiment started " + exp_id)
    await change_bind_config("first", (COOL_DOWN_IN_MINUTES * 60))
    await interim_checks(exp_id, "phase1-start")
    // Phase 1
    await do_phase_one_two(asn_instance_list_shuffled, exp_id, 1);
    await interim_checks(exp_id, "phase1-end")
    await interim_checks(exp_id, "phase1-end")
    await change_bind_config("second", (COOL_DOWN_IN_MINUTES * 60))
    await interim_checks(exp_id, "phase1-end")
    await interim_checks(exp_id, "phase1-end")
    await sleep((1000 * COOL_DOWN_IN_MINUTES * 60 + 10))
    send_telegram_message("Sleep done, starting phase 2")
    await interim_checks(exp_id, "sleep-end")
    await interim_checks(exp_id, "sleep-end")
    // Phase 2
    await do_phase_one_two(phase_one_list, exp_id, 2);
    await interim_checks(exp_id, "phase2-end")
    send_telegram_message("Experiment ended " + exp_id + " , match count: " + final_count_matched)

    let meta_data = {}
    meta_data['ttl'] = COOL_DOWN_IN_MINUTES * 60
    meta_data['chunk_size'] = CHUNK_SIZE

    let store_dict = {}
    store_dict['exp_id'] = exp_id
    store_dict['meta_data'] = meta_data
    store_dict['dict_of_phases'] = phase_one_dict

    let data = JSON.stringify(store_dict);
    fs.writeFileSync(`${exp_id}-out.json`, data);
}

init(EXP_ID_CURRENT)

// GLOBAL
// STRUC TEST
// SMALL TEST
// NXDOMAIN ??
// API CALL
// TODO telegram






