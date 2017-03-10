'use strict'

const IlpPacket = require('ilp-packet')
const assert = require('assert')
const debug = require('debug')('ilp:packet')

const serialize = IlpPacket.serializeIlpPayment
const parse = (packet) => {
  try {
    return IlpPacket.deserializeIlpPayment(packet)
  } catch (e) {
    debug('error while parsing packet: ' + e.message)
    return undefined
  }
}

function getFromTransfer (transfer) {
  assert(transfer, 'transfer must be defined. got: ' + transfer)
  assert(typeof transfer === 'object', 'got invalid transfer: ' + transfer)
  assert(Buffer.isBuffer(transfer.ilp || transfer.data),
    'transfer.ilp or transfer.data must be buffer')

  return transfer.ilp
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
