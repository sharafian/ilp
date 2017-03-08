'use strict'

const co = require('co')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const assert = chai.assert
const expect = chai.expect
const moment = require('moment')

const ILP = require('..')
const Transport = require('../src/lib/transport')
const MockPlugin = require('./mocks/mockPlugin')
const { wait } = require('../src/utils')

describe('Transport', function () {
  describe('PSK', function () {
    beforeEach(function () {
      this.params = {
        destinationAccount: 'test.example.alice',
        secret: Buffer.from('shh_its_a_secret', 'base64')
      }
    })

    it('should generate psk params', function () {
      const params = ILP.PSK.generateParams(this.params)

      assert.match(params.destinationAccount, /^test\.example\.alice/)
      assert.isString(params.sharedSecret)
    })
  })

  describe('createPacketAndCondition', function () {
    beforeEach(function () {
      this.params = {
        destinationAmount: '1',
        destinationAccount: 'test.example.alice',
        secret: Buffer.from('shh_its_a_secret', 'base64'),
        data: { foo: 'bar' },
        id: 'ee39d171-cdd5-4268-9ec8-acc349666055',
        expiresAt: moment().format()
      }
    })

    it('should create a valid packet and condition', function () {
      const result = Transport.createPacketAndCondition(this.params, 'psk')
      const { address, amount, data } = ILP.Packet.parse(result.packet)

      // the data is still encrypted, so we can't check it from just parsing
      assert.isString(data.blob)
      assert.match(address, new RegExp(this.params.destinationAccount))
      assert.equal(amount, this.params.destinationAmount)
    })

    it('should generate an id if one isn\'t provided', function () {
      delete this.params.id
      const result = Transport.createPacketAndCondition(this.params, 'psk')
      const { address } = ILP.Packet.parse(result.packet)
      assert.match(address, new RegExp(this.params.destinationAccount))
    })
  })

  beforeEach(function () {
    this.plugin = new MockPlugin()
  })

  describe('listen', function () {
    beforeEach(function () {
      this.params = {
        id: 'ee39d171-cdd5-4268-9ec8-acc349666055',
        secret: Buffer.from('shh_its_a_secret', 'base64')
      }
    })

    it('should listen', function () {
      const res = Transport.listen(this.plugin, this.params, () => {})
      assert.isFunction(res, 'should return a function')
    })

    it('should remove listeners with its function', function () {
      const res = Transport.listen(this.plugin, this.params, () => {})
      assert.equal(this.plugin.listenerCount('incoming_prepare'), 1)
      res()
      assert.equal(this.plugin.listenerCount('incoming_prepare'), 0)
    })
  })

  describe('_validateTransfer', function () {
    beforeEach(function () {
      const { packet, condition } = Transport.createPacketAndCondition({
        destinationAmount: '1',
        destinationAccount: 'test.example.alice',
        secret: Buffer.from('shh_its_a_secret', 'base64'),
        data: { foo: 'bar' },
        id: 'ee39d171-cdd5-4268-9ec8-acc349666055',
        expiresAt: moment().add(1, 'seconds').format(),
        protocol: 'ipr'
      })

      this.params = {
        protocol: 'ipr',
        id: 'ee39d171-cdd5-4268-9ec8-acc349666055',
        plugin: this.plugin,
        secret: Buffer.from('shh_its_a_secret', 'base64'),
        transfer: {
          id: 'ee39d171-cdd5-4268-9ec8-acc349666055',
          amount: '1',
          to: 'test.example.alice',
          from: 'test.example.connie',
          executionCondition: condition,
          data: packet
        }
      }
    })

    it('should accept a valid transfer', function * () {
      yield Transport._validateTransfer(this.params)
    })

    it('should not accept transfer without condition', function * () {
      delete this.params.transfer.executionCondition
      yield expect(Transport._validateTransfer(this.params))
        .to.be.rejectedWith(/no-execution/)
    })

    it('should not accept transfer for other account', function * () {
      this.params.transfer.data.ilp_header.address = 'test.example.garbage'
      yield expect(Transport._validateTransfer(this.params))
        .to.be.rejectedWith(/not-my-packet/)
    })

    it('should not accept transfer for other protocol', function * () {
      this.params.transfer.data.ilp_header.address = 'test.example.alice.~ekp'
      yield expect(Transport._validateTransfer(this.params))
        .to.be.rejectedWith(/not-my-packet/)
    })

    it('should not accept transfer for other receiver', function * () {
      this.params.transfer.data.ilp_header.address =
        'test.example.alice.~ipr.garbage'

      yield expect(Transport._validateTransfer(this.params))
        .to.be.rejectedWith(/not-my-packet/)
    })

    it('should not accept transfer for too little money', function * () {
      this.params.transfer.amount = '0.1'
      yield expect(Transport._validateTransfer(this.params))
        .to.be.rejectedWith(/insufficient/)
    })

    it('should not accept transfer for too much money', function * () {
      this.params.transfer.amount = '1.1'
      yield expect(Transport._validateTransfer(this.params))
        .to.be.rejectedWith(/overpayment/)
    })

    it('should accept extra money with "allowOverPayment"', function * () {
      this.params.transfer.amount = '1.1'
      this.params.allowOverPayment = true
      yield Transport._validateTransfer(this.params)
    })

    it('should not accept late transfer', function * () {
      this.params.transfer.data.ilp_header.data.expires_at =
        moment().add(-1, 'seconds').format()
      yield expect(Transport._validateTransfer(this.params))
        .to.be.rejectedWith(/expired/)
    })
  })

  describe('autoFulfillCondition', function () {
    beforeEach(function () {
      const { packet, condition } = Transport.createPacketAndCondition({
        destinationAmount: '1',
        destinationAccount: 'test.example.alice',
        secret: Buffer.from('shh_its_a_secret', 'base64'),
        data: { foo: 'bar' },
        id: 'ee39d171-cdd5-4268-9ec8-acc349666055',
        expiresAt: moment().add(1, 'seconds').format(),
        protocol: 'ipr'
      })

      this.params = {
        id: 'ee39d171-cdd5-4268-9ec8-acc349666055',
        secret: Buffer.from('shh_its_a_secret', 'base64'),
      }

      this.transfer = {
        id: 'ee39d171-cdd5-4268-9ec8-acc349666055',
        amount: '1',
        to: 'test.example.alice',
        from: 'test.example.connie',
        executionCondition: condition,
        data: packet
      }

      // detect when autofulfill promise has resolved
      this.fulfilled = new Promise((resolve) => {
        this.callback = resolve
      })
    })

    it('should call fulfillCondition on a valid incoming transfer', function * () {
      Transport.listen(this.plugin, this.params, this.callback, 'ipr')

      // listener returns true for debug purposes
      const res = yield this.plugin.emitAsync('incoming_prepare', this.transfer)
      assert.isTrue(res[0])

      yield this.fulfilled
    })

    it('should not fulfill when it generates the wrong fulfillment', function * () {
      this.transfer.executionCondition = 'garbage'
      Transport.listen(this.plugin, this.params, this.callback, 'ipr')

      // listener returns false for debug purposes
      const res = yield this.plugin.emitAsync('incoming_prepare', this.transfer)
      assert.isNotOk(res[0])
    })

    it('should pass the fulfill function to the callback', function * () {
      const fulfilled = new Promise((resolve) => {
        this.plugin.fulfillCondition = resolve 
      })

      this.callback = (details) => {
        assert.isObject(details.transfer, 'must pass in transfer')
        assert.isObject(details.data, 'must pass in decrypted data')
        assert.isString(details.destinationAccount, 'must pass in account')
        assert.isString(details.destinationAmount, 'must pass in amount')
        assert.isFunction(details.fulfill, 'fulfill callback must be a function')
        details.fulfill()
      }

      Transport.listen(this.plugin, this.params, this.callback, 'ipr')
      yield this.plugin.emitAsync('incoming_prepare', this.transfer)
      yield fulfilled
    })
  })
})