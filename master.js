process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
var username = 'lum-customer-c_9c799542-zone-protick';
var password = 'cbp4uaamzwpy';
var port = 22225;
var session_id = (1000000 * Math.random())|0;
var options = {
    auth: {
        username: username+'-asn-3-dns-remote-session-'+session_id,
        password
    },
    host: 'zproxy.lum-superproxy.io',
    port
};
require('axios-https-proxy-fix').get('http://lumtest.com/myip.json', options)
    .then(function(data){
        console.log(data);
        },
        function(err){
        console.error(err);
    });