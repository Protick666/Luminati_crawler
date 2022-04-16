'use strict';
// banned stuff:
// TODO change
let LIVE = false

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
var async = require('async');
var _ = require('lodash');
var axios = require('axios');
require('log-timestamp');
const fs = require('fs');
const {v4 : uuidv4} = require('uuid');
const { Telegraf } = require('telegraf')
var envs = require('envs');


var instance_id = parseInt( envs('instance_id'));

// let live_file_source = '/Users/protick.bhowmick/PriyoRepos/OCSP_DNS_DJANGO/logs_final/live/node_code'

let app = null

if (instance_id === 1) {
    app = new Telegraf("5218575778:AAGjs0CStM2A8mmQ1Jr_LtmuIOo_7kP-_Dw");
}
else if(instance_id===2) {
    app = new Telegraf("5124273386:AAHut6JvYno4VSPr_yflqcxnkfuPey8lkww");
}
else if (instance_id===3) {
    app = new Telegraf("5180589187:AAGw-F0wqOv9uk5hoHh6seob7s45uWn9Ss0");
}
else if (instance_id===4) {
    app = new Telegraf("5217580252:AAFf1IU8Q_jyW5y2qOklvvMFxOi8eq_Z6OE");
}

// const read_path = '/Users/protick.bhowmick/WebstormProjects/ttl_exp/targeted_ttl_data_set-live-False.json'

let read_path_global = null
let read_path_local = null
if (LIVE) {
    read_path_global = '/home/protick/ocsp_dns_django/ttl_data_set-live-global-False.json'
    read_path_local = '/home/protick/ocsp_dns_django/ttl_data_set-live-local-False.json'
}
else {
    read_path_global = '/Users/protick.bhowmick/WebstormProjects/ttl_exp/ttl_data_set-live-global-False.json'
    read_path_local = '/Users/protick.bhowmick/WebstormProjects/ttl_exp/ttl_data_set-live-local-False.json'
}

// export NODE_OPTIONS=--max_old_space_size=16384
var username = 'lum-customer-c_9c799542-zone-protick-dns-remote';

const URL = 'ttlexp.exp.net-measurement.net'

// TWEAK -->
let ALLOWED_TIME_IN_MINUTES = 1
let COOL_DOWN_IN_MINUTES = 60
const CHUNK_SIZE = 600

let phase_one_list_dict = {}
let phase_one_dict = {}
let telemetry_dict = {}
let chunks = null
let chunk_index = 0
let time_gap_str = ""
let requests_completed = 0

let final_count_matched = 0


function get_chunks(perChunk, inputArray) {

    return inputArray.reduce((resultArray, item, index) => {
        const chunkIndex = Math.floor(index / perChunk)

        if (!resultArray[chunkIndex]) {
            resultArray[chunkIndex] = [] // start a new chunk
        }

        resultArray[chunkIndex].push(item)

        return resultArray
    }, [])
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function send_telegram_message(message) {
    app.telegram.sendMessage(1764697018, message);
    console.log(message)
}

function get_server(data) {
    if (data.includes("phase1")) {
        return 1;
    } else if (data.includes("phase2")) {
        return 2;
    }
    else {
        return 3;
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

function store_phase1_data(exp_id, domain, data) {
    requests_completed = requests_completed + 1
    let ip_hash = get_luminati_ip_hash(data.request.res.rawHeaders)
    let server = get_server(data.data)

    if (!(exp_id in phase_one_dict)) {
        phase_one_dict[exp_id] = {}
    }
    if (!(domain.id in phase_one_dict[exp_id])) {
        phase_one_dict[exp_id][domain.id] = {}
    }
    phase_one_dict[exp_id][domain.id]['ip_hash'] = ip_hash
    phase_one_dict[exp_id][domain.id]['asn'] = domain.asn
    phase_one_dict[exp_id][domain.id]['host-phase-1'] = server
    phase_one_dict[exp_id][domain.id]['1-time'] = Date.now()
}


async function asnLookup_phase_1(domain, exp_id, executed) {

    try {
        var luminati_session_id = (1000000000 * Math.random()) | 0;
        let a = String(Date.now());
        let uuid_str = uuidv4() + a;
        let req_url = `http://${uuid_str}.${exp_id}.${domain.asn}.1.${URL}`

        require('axios-https-proxy-fix').get(req_url,
            {
                proxy: {
                    host: 'zproxy.lum-superproxy.io',
                    port: '22225',
                    auth: {
                        username: username + '-asn-' + domain.asn + '-session-' + luminati_session_id,
                        password: 'cbp4uaamzwpy'
                    }
                },
                timeout: 10000,
                forever:true
            }
        )
            .then(function (data) {
                    store_phase1_data(exp_id, domain, data)
                    executed(null, domain.id);
                },
                function (err) {
                    executed(err, domain.id);
                    //console.error(err);
                });

    } catch (e) {
        executed(e, domain.id);
    }
}


async function do_phase_one_two(chunk, exp_id) {
    var cargoQueue = null;

    cargoQueue = async.cargoQueue( function(task, executed){
        asnLookup_phase_1(task[0], exp_id, executed)
    }, 300, 1);


    _.each(chunk, function (task) {
        let d = null;
        d = {asn: task[0], id: task[1]}

        cargoQueue.push(d, (error, task_id) => {
            if (error) {
                console.log(`An error occurred while processing task ${task_id} ${error}`);
            } else {
                console.log(`Experiment ${exp_id} Phase ${phase} Finished processing task ${task_id}`);
            }
        });
    });

    cargoQueue.drain(() => {
        console.log(' All items are succesfully processed !');
    })
    await cargoQueue.drain()
}


function array_pivot_change(arr) {

    let pivot = Math.floor(Math.random() * (arr.length - 2));
    if(pivot === 0) {
        pivot += 1;
    }
    let first = arr.slice(0, pivot);
    let second = arr.slice(pivot, arr.length);

    return second.concat(first)

}


function get_asn_list(mode) {
    let rawdata = null

    rawdata = fs.readFileSync(read_path_local);

    let asn_instance_list = JSON.parse(rawdata);
    return array_pivot_change(asn_instance_list);
}




//----------------------1---------live_node_15_1
async function init(exp_iteration, exp_id, mode) {
    send_telegram_message("Experiment started " + exp_iteration)

    let asn_instance_list_shuffled = get_asn_list(mode)
    asn_instance_list_shuffled = asn_instance_list_shuffled.slice(0, 500);

    send_telegram_message("First ASN " + asn_instance_list_shuffled[0][0])

    chunks = get_chunks(CHUNK_SIZE, asn_instance_list_shuffled)

    for (let step = 0; step < chunks.length; step++) {
        let chunk = chunks[step]
        await do_phase_one_two(chunk, exp_id)
    }

    var base_dir_to_save = `recursive/results_${COOL_DOWN_IN_MINUTES}/${instance_id}/`;

    if (!fs.existsSync(base_dir_to_save)){
        fs.mkdirSync(base_dir_to_save, { recursive: true });
    }

    let store_dict = {}
    store_dict['exp_id'] = exp_id
    store_dict['ttl'] = COOL_DOWN_IN_MINUTES * 60
    store_dict['dict_of_phases'] = phase_one_dict
    let data = JSON.stringify(store_dict);
    fs.writeFileSync(`${base_dir_to_save}${exp_iteration}.json`, data);
}

async function init_mama(cool_down) {
    COOL_DOWN_IN_MINUTES = cool_down
    ALLOWED_TIME_IN_MINUTES = 1

    let  i = 0
    while (true) {
        i = i + 1
        send_telegram_message("Starting for " + instance_id + " exp " + i)
        let mode = (i % 2) + 1;
        phase_one_list_dict = {}
        phase_one_dict = {}
        telemetry_dict = {}
        time_gap_str = ""
        chunks = null
        chunk_index = 0
        final_count_matched = 0
        requests_completed = 0
        let exp_id_prefix = null

        if (LIVE) {
            exp_id_prefix = `live_recur_${COOL_DOWN_IN_MINUTES}`;
        }
        else {
            exp_id_prefix = `local_recur_${COOL_DOWN_IN_MINUTES}`;
        }

        await init(i, exp_id_prefix, mode);
        await sleep(1000)

        send_telegram_message("Experiment iteration ended " + i +  " , request count: " + requests_completed )
    }
}

// TODO change
init_mama(60)




