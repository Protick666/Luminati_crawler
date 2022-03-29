function get_luminati_ip_hash(headers) {
    for(let i = 0; i < headers.length; i++) {
        if(headers[i] === 'x-luminati-ip') {
            return headers[i + 1];
        }
    }
    return "-1"
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
require('axios-https-proxy-fix').get('http://lumtest.com/myip.json',
    {
        proxy: {
            host: 'zproxy.lum-superproxy.io',
            port: '22225',
            auth: {
                username: 'lum-customer-c_9c799542-zone-protick-asn-3',
                password: 'cbp4uaamzwpy'
            }
        }
    }
)
    .then(function(data){
        console.log(data);
        let headers = data.request.res.rawHeaders;
        console.log(get_luminati_ip_hash(headers))
        let server_data = data.data
        },
        function(err){
        console.error(err);
    });