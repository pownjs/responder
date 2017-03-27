const os = require('os')
const dns = require('dns')
const dgram = require('dgram')
const dnsJS = require('dns-js')
const each = require('async/each')
const EventEmitter = require('events')
const ipAddress = require('ip-address')
const applyEach = require('async/applyEach')

// TODO: DNS resolution should be provided by a pown module
// TODO: DGRAM server support should be provied by a pown module

class Responder extends EventEmitter {
    constructor(options) {
        super()

        this.options(options)

        this.map = {}
        this.started = false
    }

    options(options) {
        options = options || {}

        this.ttl = options.ttl || this.ttl || 2600
        this.family = options.family || this.family || [4]
    }

    insert(name, response, done) {
        if (!response) {
            let nics

            nics = Object.entries(os.networkInterfaces()).map(n => n[1])
            nics = Array.prototype.concat.apply([], nics)
            nics = nics.filter(n => !n.internal && !n.address.startsWith('169.254') && !n.address.startsWith('fe80'))

            this.map[name] = {
                4: nics.filter(n => n.family === 'IPv4').map(n => n.address)[0],
                6: nics.filter(n => n.family === 'IPv6').map(n => n.address)[0]
            }

            if (done) {
                done(null)
            }

            return
        }

        let address

        address = new ipAddress.Address4(response)

        if (address.isValid()) {
            this.map[name] = {4: response, 6: undefined}

            if (done) {
                done(null)
            }

            return
        }

        address = new ipAddress.Address6(response)

        if (address.isValid()) {
            this.map[name] = {4: undefined, 6: response}

            if (done) {
                done(null)
            }

            return
        }

        applyEach([dns.resolve4.bind(dns), dns.resolve6.bind(dns)], response, (err, results) => {
            if (err) {
                if (done) {
                    done(err)
                } else {
                    throw err
                }

                return
            }

            const pair = results.map(result => result[0])

            this.map[name] = {4: pair[0], 6: pair[1]}

            if (done) {
                done(null)
            }
        })
    }

    remove(name, done) {
        delete this.map[name]

        if (done) {
            done(null)
        }
    }

    clear(done) {
        this.map = {}

        if (done) {
            done(null)
        }
    }

    onMessageHandler(server, family, message, info) {
        let packet;

        try {
            packet = dnsJS.DNSPacket.parse(message)
        } catch (e) {
            this.emit('error', e)

            return
        }

        packet.question.forEach((question) => {
            this.emit('question', question, info)

            const standardResponse = this.map[question.name]

            if (standardResponse) {
                // TODO: maybe send both 4 and 6 responses

                packet.answer.push({
                    name: question.name,
                    type: {4: dnsJS.DNSRecord.Type.A, 6: dnsJS.DNSRecord.Type.AAAA}[family],
                    class: dnsJS.DNSRecord.Class.IN,
                    ttl: this.ttl,
                    address: standardResponse[family]
                })
            }

            const wildcardResponse = this.map['*']

            if (wildcardResponse) {
                // TODO: maybe send both 4 and 6 responses

                packet.answer.push({
                    name: question.name,
                    type: {4: dnsJS.DNSRecord.Type.A, 6: dnsJS.DNSRecord.Type.AAAA}[family],
                    class: dnsJS.DNSRecord.Class.IN,
                    ttl: this.ttl,
                    address: wildcardResponse[family]
                })
            }
        })

        if (packet.answer.length > 0) {
            packet.header.qr = 1

            server.send(dnsJS.DNSPacket.toBuffer(packet), info.port, info.address, (err) => {
                if (err) {
                    this.emit('error', err)
                } else {
                    this.emit('answer', packet, info.port, info.address)
                }
            })
        }
    }

    start(options, done) {
        if (typeof(options) === 'function') {
            done = options
            options = {}
        }

        if (!done) {
            done = (err) => {
                if (err) {
                    throw err
                }
            }
        }

        if (this.started) {
            done(new Error('already started'))

            return
        }

        this.options(options)

        this.started = true

        const tasks = []

        this.servers = []

        each(new Set(this.family), (family, done) => {
            if (family === 6) {
                done(new Error(`network address family ${family} is not currently supported`))

                return
            }

            each([{port: 5355, membership: '224.0.0.252'}], (info, done) => {
                const port = info.port
                const membership = info.membership
                
                const server = dgram.createSocket({type: `udp${family}`, reuseAddr: true})

                server.on('listening', this.emit.bind(this, 'listening', server))
                server.on('message', this.emit.bind(this, 'message', server))
                server.on('error', this.emit.bind(this, 'error', server))
                server.on('close', this.emit.bind(this, 'close', server))

                server.bind(port, (err) => {
                    if (err) {
                        done(err)

                        return
                    }

                    server.addMembership(membership)

                    done(null)
                })

                server.on('message', this.onMessageHandler.bind(this, server, family))

                this.servers.push(server)
            }, done)
        }, (err) => {
            if (err) {
        		this.stop(done)

                return
            }

            done(null)
        })
    }

    stop(done) {
        if (!done) {
            done = (err) => {
                if (err) {
                    throw err
                }
            }
        }

        if (!this.started) {
            done(error = new Error('not started'))

            return
        }

        each(this.servers, ((server, done) => server.close(done)), (err) => {
            if (err) {
                done(err)

                return
            }

            this.servers = []
            this.started = false

            done(null)
        })
    }
}

module.exports = Responder
