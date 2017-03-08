'use strict'
const EventEmitter2 = require('eventemitter2')

module.exports = class MockPlugin extends EventEmitter2 {
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

  rejectIncomingTransfer () {
    return Promise.resolve(null)
  }
}
