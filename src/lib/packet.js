'use strict'

const IlpPacket = require('ilp-packet')
const assert = require('assert')
const { omitUndefined } = require('../utils')
const base64url = require('../utils/base64url')

const serialize = IlpPacket.serializeIlpPayment
const parse = IlpPacket.deserializeIlpPayment

function getFromTransfer (transfer) {
  assert(transfer, 'transfer must be defined. got: ' + transfer)
  assert(typeof transfer === 'object', 'got invalid transfer: ' + transfer)
  assert(Buffer.isBuffer(transfer.ilp || transfer.data),
    'transfer.ilp or transfer.data must be buffer')

  return transfer.ilp || transfer.data
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
