exports.yargs = {
    command: 'responder [options]',
    describe: 'LLMNR responder',

    builder: {
        strict: {
            alias: 's',
            type: 'boolean',
            default: false,
            describe: 'Strict mode'
        },

        ttl: {
            alias: 't',
            type: 'number',
            default: 2600,
            describe: 'Time to live for response'
        },

        family: {
            alias: 'f',
            type: 'array',
            default: [4],
            choices: [4, 6],
            describe: 'Network address family'
        },

        respond: {
            alias: 'r',
            type: 'array',
            default: ['*:'],
            describe: 'Respond in the form name:response'
        }
    },

    handler: (argv) => {
        const chalk = require('chalk')

        // Get instance of the global responder singleton.

        const responder = require('./index')

        // Each respond comes in the form name:response. The name parameter is
        // the name to respond to. Star (*) will respond to all names. A blank
        // response name will result into responding with the local IP address.

        argv.respond.forEach((respond) => {
            respond.split(',').forEach((token) => {
                const pair = token.split(':', 2)

                responder.insert(pair[0], pair[1], (err) => {
                    if (err) {
                        console.error(chalk.red('-'), chalk.white.bgRed(err.message || err))

                        if (argv.strict) {
                            process.exit(2)
                        }
                    }
                })
            })
        })

        // Listen on events.

        responder.on('listening', (server) => {
            console.log(chalk.green('*'), `listening on ${server.address().address}:${server.address().port}`)
        })

        responder.on('question', (question, info) => {
            console.log(chalk.green('*'), `${info.address}:${info.port} looking for ${chalk.bold(question.name)}`)
        })

        responder.on('answer', (packet, port, address) => {
            console.log(chalk.green('*'), `responded to ${address}:${port} with ${packet.answer.map(_ => chalk.bold(`${_.name} -> ${_.address}`)).join(',')}`)
        })

        responder.on('error', (error) => {
            console.error(chalk.red('-'), chalk.white.bgRed(error.message || error))
        })

        // Start the server.

        responder.start({ttl: argv.ttl, family: argv.family}, (err) => {
            if (err) {
                console.error(chalk.red('-'), chalk.white.bgRed(err.message || err))

                process.exit(2)
            }
        })
    }
}
