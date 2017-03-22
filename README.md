# pown-responder [![Gitter](https://img.shields.io/gitter/room/nwjs/nw.js.svg)](https://gitter.im/pownjs/Lobby)

> LLMNR responder.


## How To Use

The Pown Responder will respond on LLMNR multicast queries. By default the tool will respond to all queries with your external IP address. However, you can achieve more interesting results with the help of the configuration options. 

For example, in order to respond to all requests for wpad with the current host IP address we can execute a command like this:

```sh
$ pown responder -r wpad:
```

Anything after the column is the response so in order respond to wpad with the IP address of attacker.com, the syntax looks like this:

```
$ pown responder -r wpad:attacker.com
```

In order to redirect everything the command looks like this:

```sh
$ pown responder -r *:
```

This is also the default behaviour when executing:

```sh
$ pown responder
```

## How To Contribute

Pown Responder is still in development although the LLMNR implementation is 100% functional. However, the following number of features will be good to have.

* [ ] mDNS support (can be done with small modifications of the existing code)
* [ ] NBTNS support
* [ ] Interactive support (perhaps a generic pown-cli command required)

## Quickstart

From the same directory as your project's package.json, install this module with the following command:

```sh
$ npm install pown-responder --save
```

Once that's done, you can invoke pown responder like this:

```sh
$ POWN_ROOT=. pown responder
```

If installed globally or as part of Pown.js distribution invoke like this:

```sh
$ pown responder
```
