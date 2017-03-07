'use strict'

const assert = require('assert')
const { omitUndefined } = require('../utils')

function serialize ({
  amount,
  address,
  expiresAt,
  data
}) {
  assert(amount, 'packet requires an amount. got: ' + amount)
  assert(address, 'packet requires an address. got: ' + address)
  // for now, this is an object
  return {
    ilp_header: {
      amount: amount,
      address: address,
      data: omitUndefined({
        expires_at: expiresAt,
        data: data
      })
    }
  }
}

function parse (packet) {
  assert(packet, 'packet must be defined. got: ' + packet)
  assert(typeof packet === 'object', 'got invalid packet: ' + packet)
  assert(packet.ilp_header, 'got invalid packet: ' + JSON.stringify(packet))
  assert(packet.ilp_header.amount, 'packet missing amount')
  assert(packet.ilp_header.address, 'packet missing address')

  const header = packet.ilp_header
  return omitUndefined({
    amount: header.amount,
    address: header.address,
    expiresAt: header.data && header.data.expires_at,
    data: header.data && header.data.data
  })
}

function getFromTransfer (transfer) {
  assert(transfer, 'transfer must be defined. got: ' + transfer)
  assert(typeof transfer === 'object', 'got invalid transfer: ' + transfer)
  assert(transfer.data, 'transfer missing data: ' + JSON.stringify(transfer))
  assert(typeof transfer.data === 'object', 'got invalid transfer data: ' +
    transfer.data)
  assert(transfer.data.ilp_header, 'transfer.data missing ilp_header: ' +
    JSON.stringify(transfer.data))

  return transfer.data
}

function parseFromTransfer (transfer) {
  return parse(getFromTransfer(transfer))
}

module.exports = {
  serialize,
  parse,
  getFromTransfer,
  parseFromTransfer
}
