/**
 * MHZ-19 UART Monitor
 * @author skitsanos
 */

const winston = require('winston');
const Transport = require('winston-transport');
const fs = require('fs');

const SerialPort = require('serialport');
const port = new SerialPort('/dev/tty.usbserial', {baudRate: 9600, autoOpen: false});

class FileTransport extends Transport
{
    constructor(opts)
    {
        super(opts);
    }

    log(info, callback)
    {
        fs.appendFile(process.cwd() + '/app.log', `${info.level} ${info.message}\n`, (err) =>
        {
            if (err)
            {
                console.log(err.message);
            }
        });
        callback();
    }
}

const loggingFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.splat(),
    winston.format.printf(info =>
    {
        return ` ${(new Date()).getTime()} ${info.level}: ${info.message}`;
    }));

const log = winston.createLogger({
    exitOnError: false,
    //level: 'debug',
    transports: [
        new FileTransport(
            {
                format: loggingFormat,
                timestamp: true
            }
        ),
        new winston.transports.Console({
            format: loggingFormat
        })
    ]
});

let app = {
    meta: require('./package'),

    commands: {
        READ_VALUE: Buffer.from([0xff, 0x01, 0x86, 0x00, 0x00, 0x00, 0x00, 0x00, 0x79])
    },

    utils: {
        ord: (str) =>
        {
            console.log(str);
            return str.charCodeAt(0);
        },

        sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms))
    },

    serial: {
        list: () =>
        {
            SerialPort.list().then((arr_portInfo) =>
            {
                arr_portInfo.map(el =>
                {
                    console.log(el);
                    log.info('Found: ' + el.comName);
                });
            });
        },

        open: () =>
        {
            if (port !== undefined)
            {
                return new Promise((resolve, reject) =>
                {
                    port.open(err =>
                    {
                        if (err)
                        {
                            return reject(err);
                        }

                        return resolve();
                    });
                });

            }
            else
            {
                log.error('Failed to open port. Not found?');
            }
        },

        close: () =>
        {
            if (port !== undefined)
            {
                log.debug('Closing serial port');
                port.close();
            }
            else
            {
                log.error('Failed to open port. Not found?');
            }
        },

        write: (data) =>
        {
            return new Promise((resolve, reject) =>
            {
                if (port !== undefined)
                {
                    log.debug('Writing to serial port...');
                    port.write(data, (err) =>
                    {
                        if (err)
                        {
                            return reject(err);
                        }

                        return resolve();
                    });
                }
                else
                {
                    return reject({message: 'Failed to write. Not found?'});
                }
            });
        }
    }
};

log.info(`${app.meta.name} ver. ${app.meta.version}`);

app.serial.open().then(() =>
{
    log.debug('Port open');

    port.on('readable', async () =>
    {
        const buf = port.read(9);
        if (buf !== null && Buffer.byteLength(buf) === 9)
        {
            if (buf[0] === 0xff && buf[1] === 0x86)
            {
                const co2 = Number(buf[2].toString()) * 256 + Number(buf[3].toString());
                log.info(`${co2}ppm`);
            }
            await app.utils.sleep(5000);
            app.serial.write(app.commands.READ_VALUE);
        }
    });

    app.serial.write(app.commands.READ_VALUE).then(() =>
    {
    }).catch(err => log.error(err.message));

}).catch(err => log.error(err.message));
