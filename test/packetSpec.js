'use strict'

const chai = require('chai')
const assert = chai.assert
const Packet = require('..').Packet

describe('Packet', function () {
  beforeEach(function () {
    this.packet = {
      ilp_header: {
        amount: '10',
        account: 'test.example.alice',
        data: {
          foo: 'bar'
        }
      }
    }

    this.parsed = {
      destinationAmount: '10',
      destinationAccount: 'test.example.alice',
      data: { foo: 'bar' }
    }

    this.transfer = {
      id: '472537fc-5d20-4b03-b4b8-b532fa3d8c99',
      amount: '10',
      account: 'test.local.connie',
      expiresAt: '2017-03-07T11:06:47.752Z',
      executionCondition: '47DEQpj8HBSa_-TImW_5JCeuQeRkm5NMpJWZG3hSuFU',
      data: this.packet
    }
  })

  describe('parse', function () {
    it('should parse a packet', function () {
      assert.deepEqual(
        Packet.parse(this.packet),
        this.parsed)
    })

    it('should not parse a packet w/o amount', function () {
      delete this.packet.ilp_header.amount
      assert.throws(() => Packet.parse(this.packet),
        /missing amount/)
    })

    it('should not parse a packet w/o account', function () {
      delete this.packet.ilp_header.account
      assert.throws(() => Packet.parse(this.packet),
        /missing account/)
    })

    it('should parse a packet w/o data', function () {
      delete this.packet.ilp_header.data
      Packet.parse(this.packet)
    })
  })

  describe('serialize', function () {
    it('should serialize a packet', function () {
      assert.deepEqual(
        Packet.serialize(this.parsed),
        this.packet)
    })

    it('should not serialize a packet w/o destinationAmount', function () {
      delete this.parsed.destinationAmount
      assert.throws(() => Packet.serialize(this.parsed),  
        /requires a destinationAmount/)
    })

    it('should not serialize a packet w/o destinationAccount', function () {
      delete this.parsed.destinationAccount
      assert.throws(() => Packet.serialize(this.parsed),
        /requires a destinationAccount/)
    })

    it('should serialize a packet w/o data', function () {
      delete this.parsed.data
      Packet.serialize(this.parsed)
    })
  })

  describe('getFromTransfer', function () {
    it('should get the packet from transfer', function () {
      assert.deepEqual(
        Packet.getFromTransfer(this.transfer),
        this.packet)
    })

    it('should not get packet w/o data', function () {
      delete this.transfer.data
      assert.throws(() => Packet.getFromTransfer(this.transfer), /transfer missing data/)
    })

    it('should not get packet w/o ilp_header in data', function () {
      delete this.transfer.data.ilp_header
      assert.throws(() => Packet.getFromTransfer(this.transfer), /missing ilp_header/)
    })
  })

  describe('parseTransfer', function () {
    it('should parse a packet from transfer', function () {
      assert.deepEqual(
        Packet.parseFromTransfer(this.transfer),
        this.parsed)
    })
  })
})
