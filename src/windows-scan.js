const execFile = require('child_process').execFile;
const networkUtils = require('./utils/network-utils');
const env = require('./env');

function scanWifi(config, callback) {
    try {
        execFile(
            'netsh',
            ['wlan', 'show', 'networks', 'mode=Bssid'],
            {env},
            (err, scanResults) => {
                if (err) {
                    callback && callback(err);
                    return;
                }

                scanResults = scanResults
                    .toString('utf8')
                    .split('\r')
                    .join('')
                    .split('\n')
                    .slice(4, scanResults.length);

                let numNetworks = -1;
                let currentLine = 0;
                let networkTmp;
                const networksTmp = [];
                let network;
                const networks = [];
                let i;

                for (i = 0; i < scanResults.length; i++) {
                    if (scanResults[i] === '') {
                        numNetworks++;
                        networkTmp = scanResults.slice(currentLine, i);
                        networksTmp.push(networkTmp);
                        currentLine = i + 1;
                    }
                }

                for (i = 0; i < numNetworks; i++) {
                    // skip empty networks
                    if (networksTmp[i] && networksTmp[i].length > 0) {
                        network = parse(networksTmp[i]);
                        networks.push(network);
                    }
                }

                callback && callback(null, networks);
            }
        );
    } catch (e) {
        callback && callback(e);
    }
}

// Helper function to extract values using regular expressions
function extractValue(str, regex) {
    const trimmedStr = str.trim();
    const match = trimmedStr.match(regex);
    return match ? match[1].trim() : null;
}


function parse(networkTmp) {
    const network = {
        channel: -1,
        quality: 0,
        signal_level: Number.MIN_VALUE,
        security: '',
        security_flags: ''
    };

    for (const item of networkTmp) {

        const ssid = extractValue(item, /^SSID \d+ : (.+)/);
        if (ssid) {
            network.ssid = ssid;
            continue;
        }

        const mac = extractValue(item, /^BSSID .+ : (.+)/);
        if (mac) {
            network.mac = mac;
            continue;
        }

        const channel = extractValue(item, /^Channel .+ : (\d+)/);
        if (channel) {
            network.channel = parseInt(channel);
            continue;
        }

        const signalLevel = extractValue(item, /^Signal .+ : (\d+)%/);
        if (signalLevel) {
            network.quality = parseInt(signalLevel);
            network.signal_level = networkUtils.dBFromQuality(signalLevel);
            continue;
        }

        const authentication = extractValue(item, /^Authentication\s*:\s*(.+)/);
        if (authentication) {
            network.security = authentication;
            continue;
        }

        const securityFlags = extractValue(item, /^Encryption\s+:\s+(.+)/);
        if (securityFlags) {
            network.security_flags = securityFlags;
            continue;
        }
    }

    network.bssid = network.mac;
    network.frequency = network.channel !== -1
        ? parseInt(networkUtils.frequencyFromChannel(network.channel))
        : 0;
    network.mode = 'Unknown';

    return network;
}

module.exports = config => {
    return callback => {
        if (callback) {
            scanWifi(config, callback);
        } else {
            return new Promise((resolve, reject) => {
                scanWifi(config, (err, networks) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(networks);
                    }
                });
            });
        }
    };
};
