'use strict'

const assert = require('assert')
const { omitUndefined } = require('../utils')

function serialize ({
  destinationAmount,
  destinationAccount,
  data
}) {
  assert(destinationAmount,
    'packet requires a destinationAmount. got: ' + destinationAmount)
  assert(destinationAccount,
    'packet requires a destinationAccount. got: ' + destinationAccount)

  // for now, this is an object
  return {
    ilp_header: {
      amount: destinationAmount,
      account: destinationAccount,
      data: data || {}
    }
  }
}

function parse (packet) {
  assert(packet, 'packet must be defined. got: ' + packet)
  assert(typeof packet === 'object', 'got invalid packet: ' + packet)
  assert(packet.ilp_header, 'got invalid packet: ' + JSON.stringify(packet))
  assert(packet.ilp_header.amount, 'packet missing amount')
  assert(packet.ilp_header.account, 'packet missing account')

  const header = packet.ilp_header
  return omitUndefined({
    destinationAmount: header.amount,
    destinationAccount: header.account,
    data: header.data || {}
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

  return { ilp_header: transfer.data.ilp_header }
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
