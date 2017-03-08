'use strict'

const chai = require('chai')
const moment = require('moment')
const assert = chai.assert
const ILQP = require('..').ILQP
const Packet = require('..').Packet
const MockPlugin = require('./mocks/mockPlugin')
const expect = chai.expect
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)

describe('ILQP', function () {
  beforeEach(function () {
    this.plugin = new MockPlugin()
    // quote response
    this.id = '85e04e5c-2357-4033-ac5b-251ce97faf33'
    this.response = {
      data: {
        id: this.id,
        method: 'quote_response',
        data: {
          source_amount: '1',
          destination_amount: '1',
          source_connector_account: 'test.example.connie',
          source_expiry_duration: '0'
        }
      }
    }
  })

  describe('quote', function () {
    beforeEach(function () {
      this.params = {
        sourceAddress: 'test.example.alice',
        destinationAddress: 'test.local.bob',
        sourceAmount: '1',
        sourceExpiryDuration: '0',
        destinationExpiryDuration: '0',
        connectors: [ 'test.example.connie' ]
      }
      this.result = {
        sourceAmount: '1',
        destinationAmount: '1',
        connectorAccount: 'test.example.connie',
        sourceExpiryDuration: '0'
      }

      this.plugin.sendMessage = (msg) => {
        this.response.data.id = msg.data.id
        this.plugin.emit('incoming_message', this.response)
        return Promise.resolve(null)
      }
    })

    it('should return a quote from the connector', function * () {
      this.result.expiresAt = moment().format()
      const response = yield ILQP.quote(this.plugin, this.params)
      assert.deepEqual(
        response,
        this.result)
    })

    it('should default to getInfo\'s connectors', function * () {
      // remove manually provided connectors
      delete this.params.connectors

      this.result.expiresAt = moment().format()
      const response = yield ILQP.quote(this.plugin, this.params)
      assert.deepEqual(
        response,
        this.result)
    })

    it('should quote by destination amount', function * () {
      this.params.destinationAmount = this.params.sourceAmount
      delete this.params.sourceAmount

      this.result.expiresAt = moment().format()
      const response = yield ILQP.quote(this.plugin, this.params)
      assert.deepEqual(
        response,
        this.result)
    })

    it('should return a local quote if destination is local', function * () {
      this.params.destinationAddress = 'test.example.bob'
      const response = yield ILQP.quote(this.plugin, this.params)

      delete this.result.connectorAccount // local quote has no connector
      assert.deepEqual(response,
        this.result)
    })

    it('should throw if source and dest amounts are defined', function * () {
      this.params.destinationAmount = this.params.sourceAmount = '1'

      yield expect(ILQP.quote(this.plugin, this.params))
        .to.be.rejectedWith(/provide source or destination amount but not both/)
    })

    it('should return undefined if there are no connectors', function * () {
      this.params.connectors = []
      const response = yield ILQP.quote(this.plugin, this.params)
      assert.equal(response, undefined)
    })

    it('should return undefined on a timeout', function * () {
      this.plugin.sendMessage = () => Promise.resolve(null)
      this.params.timeout = 10
      const response = yield ILQP.quote(this.plugin, this.params)
      assert.equal(response, undefined)
    })

    describe('quoteByPacket', function () {
      it('should parse quote params from packet', function * () {
        // the response we're using gives sourceExpiryDuration of 0
        this.result.expiresAt = moment().format()

        const response = yield ILQP.quoteByPacket(
          this.plugin,
          Packet.serialize({
            amount: '1',
            address: 'test.local.bob'
          })
        )
        assert.deepEqual(
          response,
          this.result)
      })
    })
  })

  describe('_getQuote', function () {
    beforeEach(function () {
      this.params = {
        plugin: this.plugin
      }
    })

    it('should return the data from the message response', function * () {
      this.plugin.sendMessage = (msg) => {
        this.response.data.id = msg.data.id
        this.plugin.emit('incoming_message', this.response)
        return Promise.resolve(null)
      }

      const response = yield ILQP._getQuote(this.params)
      assert.deepEqual(
        response,
        this.response.data.data)
    })

    it('should resolve to undefined on an error', function * () {
      this.params.timeout = 10
      const response = yield ILQP._getQuote(this.params)

      assert.equal(response, undefined)
    })
  })

  describe('_sendAndReceiveMessage', function () {
    beforeEach(function () {
      this.params = {
        plugin: this.plugin, 
        method: 'quote_response',
        message: {
          data: { id: this.id }
        }
      }
    })

    it('should resolve on response message', function * () {
      const promise = ILQP._sendAndReceiveMessage(this.params)
      this.plugin.emit('incoming_message', this.response)
      yield promise
    })

    it('should ignore a message that doesn\'t match its id', function * () {
      const promise = ILQP._sendAndReceiveMessage(this.params)
      
      this.plugin.emit('incoming_message', {
        data: {
          id: 'garbage',
          method: 'error',
          data: 'someone else\'s error'
        }
      })
      this.plugin.emit('incoming_message', this.response)

      yield promise
    })

    it('should reject on error message', function * () {
      this.response.data.method = 'error'
      this.response.data.data = { message: 'there was an error' }

      const promise = ILQP._sendAndReceiveMessage(this.params)
      this.plugin.emit('incoming_message', this.response)

      yield expect(promise)
        .to.eventually.be.rejectedWith(/there was an error/)
    })

    it('should time out without response', function * () {
      this.params.timeout = 10
      const promise = ILQP._sendAndReceiveMessage(this.params)

      yield expect(promise)
        .to.eventually.be.rejectedWith(/quote request timed out/)
    })
  })

  describe('_getCheaperQuote', function () {
    beforeEach(function () {
      this.quote1 = { source_amount: '1', destination_amount: '1' }
      this.quote2 = { source_amount: '1', destination_amount: '1' }
    })

    it('should choose quote1 if it costs less (source)', function () {
      this.quote1.source_amount = '0.1'
      assert.deepEqual(
        ILQP._getCheaperQuote(this.quote1, this.quote2),
        this.quote1)
    })

    it('should choose quote1 if it pays more (destination)', function () {
      this.quote2.destination_amount = '0.1'
      assert.deepEqual(
        ILQP._getCheaperQuote(this.quote1, this.quote2),
        this.quote1)
    })

    it('should choose quote2 otherwise', function () {
      assert.deepEqual(
        ILQP._getCheaperQuote(this.quote1, this.quote2),
        this.quote2)
    })
  })
})
