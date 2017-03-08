'use strict'
const co = require('co')
const assert = require('assert')
const agent = require('superagent')
const uuid = require('uuid/v4')
const moment = require('moment')

const ILQP = require('./ilqp')
const PSK = require('./psk')
const { xor } = require('../utils')

/**
 * @module SPSP
 */

const _getHref = (res, field) => {
  for (let link of res.links) {
    if (link.rel === field) return link.href
  }
  throw new Error(field + ' not found in ' + JSON.stringify(res))
}

const _getSPSPFromReceiver = function * (receiver) {
  const host = receiver.split('@')[1]
  const resource = (yield agent
    .get('https://' + host + '/.well-known/webfinger?resource=acct:' + receiver)
    .set('Accept', 'application/json')).body

  return _getHref(resource, 'https://interledger.org/rel/spsp/v1')
}

const _querySPSP = function * (receiver) {
  const endpoint = (receiver.indexOf('@') >= 0)
    ? (yield _getSPSPFromReceiver(receiver))
    : receiver

  return (yield agent
    .get(endpoint)
    .set('Accept', 'application/json')).body
}

const _createPayment = (spsp, quote, id) => {
  return {
    id: id || uuid(),
    sourceAmount: quote.sourceAmount,
    destinationAmount: quote.destinationAmount,
    destinationAccount: spsp.destination_account,
    connectorAccount: quote.connectorAccount,
    sourceExpiryDuration: quote.sourceExpiryDuration,
    spsp: spsp,
  }
}

const query = co.wrap(_querySPSP)

const quote = function * (plugin, {
  receiver,
  sourceAmount,
  destinationAmount,
  connectors,
  id,
  timeout
}) {
  assert(plugin, 'missing plugin')
  assert(receiver, 'receiver')
  assert(xor(sourceAmount, destinationAmount),
    'destinationAmount or sourceAmount must be specified')

  const spsp = yield _querySPSP(receiver)
  const quote = yield ILQP.quote(plugin, {
    destinationAddress: spsp.destination_account,
    destinationAmount,
    sourceAmount,
    connectors,
    id,
    timeout
  })

  if (!quote) {
    throw new Error('unable to get quote to destinationAddress ' +
      spsp.destination_account + ' with spsp parameters: ' +
      JSON.stringify(spsp))
  }

  if (+quote.destinationAmount > +spsp.maximum_destination_amount ||
      +quote.destinationAmount < +spsp.minimum_destination_amount) {
    throw new Error('Destination amount (' +
      quote.destinationAmount +
      ') is outside of range [' +
      spsp.maximum_destination_amount +
      ', ' +
      spsp.minimum_destination_amount +
      ']')
  }

  return _createPayment(spsp, quote, id)
}


function * sendPayment (plugin, payment) {
  assert(plugin, 'missing plugin')
  assert(payment, 'missing payment')
  assert(payment.spsp, 'missing SPSP response in payment')
  assert(payment.spsp.shared_secret, 'missing SPSP shared_secret')
  assert(payment.destinationAmount, 'missing destinationAmount')
  assert(payment.sourceAmount, 'missing sourceAmount')
  assert(payment.destinationAccount, 'missing destinationAccount')
  assert(payment.sourceExpiryDuration, 'missing sourceExpiryDuration')
  assert(payment.id, 'payment must have an id')

  const { packet, condition } = PSK.createPacketAndCondition({
    sharedSecret: Buffer.from(payment.spsp.shared_secret, 'base64'),
    destinationAmount: payment.destinationAmount,
    destinationAccount: payment.destinationAccount,
    data: payment.data, // optional
    expiresAt: payment.expiresAt // optional
  })

  const fulfill = new Promise((resolve, reject) => {
    function remove () {
      plugin.removeListener('outgoing_fulfill', fulfill)
      plugin.removeListener('outgoing_cancel', cancel)
      plugin.removeListener('outgoing_reject', cancel)
    }

    function fulfill (transfer, fulfillment) {
      if (transfer.id !== payment.id) return
      remove()
      resolve({ fulfillment })
    }

    function cancel (transfer) {
      if (transfer.id !== payment.id) return
      remove()
      reject(new Error('transfer ' + payment.id + ' failed.'))
    }

    plugin.on('outgoing_fulfill', fulfill)
    plugin.on('outgoing_cancel', cancel)
    plugin.on('outgoing_reject', cancel)
  })

  yield plugin.sendTransfer({
    id: payment.id,
    // TODO: should connectorAccount become destinationAccount when
    // there is no connector?
    to: payment.connectorAccount || payment.destinationAccount,
    amount: payment.sourceAmount,
    data: packet,
    executionCondition: condition,
    expiresAt: moment()
      .add(payment.sourceExpiryDuration, 'seconds')
      .format()
  })

  return yield fulfill
}

/**
  * Parameters for an SPSP payment
  * @typedef {Object} SpspPayment
  * @property {id} id UUID to ensure idempotence between calls to sendPayment
  * @property {string} source_amount Decimal string, representing the amount that will be paid on the sender's ledger.
  * @property {string} destination_amount Decimal string, representing the amount that the receiver will be credited on their ledger.
  * @property {string} destination_account Receiver's ILP address.
  * @property {string} connector_account The connector's account on the sender's ledger. The initial transfer on the sender's ledger is made to this account.
  * @property {string} spsp SPSP response object, containing details to contruct transfers.
  * @property {string} data extra data to attach to transfer.
  */

module.exports = {
  _getHref,
  _getSPSPFromReceiver, 
  _querySPSP,
  _createPayment,
  quote: co.wrap(quote),
  sendPayment: co.wrap(sendPayment),
  query
}
