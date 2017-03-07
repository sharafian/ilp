'use strict'
const EventEmitter = require('events')

module.exports = class MockPlugin extends EventEmitter {
  constructor () {
    super()
  }

  connect () {
    return Promise.resolve(null)
  }

  getInfo () {
    return {
      prefix: 'test.example.',
      connectors: [ 'test.connie' ],
      precision: 19,
      scale: 9
    }
  }

  getAccount () {
    return 'test.example.alice'
  }

  sendMessage () {
    return Promise.resolve(null)
  }

  sendTransfer () {
    return Promise.resolve(null)
  }
}
