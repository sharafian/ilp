'use strict'

function serialize ({
  amount,
  address,
  expiresAt,
  data
}) {
  // for now, this is an object
  return {
    ilp_header: {
      amount: amount,
      address: address,
      data: {
        expires_at: expiresAt,  
        data: data
      }
    }
  }
}

function parse (packet) {
  assert(packet, 'packet must be defined. got: ' + packet)
  assert(typeof packet === 'object', 'got invalid packet: ' + packet)
  assert(packet.ilp_header, 'got invalid packet: ' + JSON.stringify(packet))

  const header = packet.ilp_header
  return {
    amount: header.amount,
    address: header.address,
    expiresAt: header.data.expires_at,
    data: header.data.data
  }
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
