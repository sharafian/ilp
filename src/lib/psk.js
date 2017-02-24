'use strict'

const Packet = require('./packet')
const cryptoHelper = require('../utils/crypto')
const uuid4 = require('uuid')
const cc = require('../utils/condition')
const Transport = require('./transport')

/**
  * Create a payment request using a Pre-Shared Key (PSK).
  *
  * @param {Object} params Parameters for creating payment request
  * @param {String} params.destinationAmount Amount that should arrive in the recipient's account
  * @param {String} params.destinationAccount Target account's ILP address
  * @param {String} params.sharedSecret Shared secret for PSK protocol
  * @param {String} [params.id=uuid.v4()] Unique ID for the request (used to ensure conditions are unique per request)
  * @param {String} [params.expiresAt=30 seconds from now] Expiry of request
  * @param {Object} [params.data=null] Additional data to include in the request
  *
  * @return {Object} Payment request
  */
function createPacketAndCondition ({
  destinationAmount,
  destinationAccount,
  sharedSecret,
  data,
  uuid,
  expiresAt
}) {
  assert(typeof destinationAmount === 'string', 'destinationAmount must be a string')
  assert(typeof destinationAccount === 'string', 'destinationAccount must be a string')
  assert(Buffer.isBuffer(sharedSecret), 'sharedSecret must be a buffer')

  return Transport.createPacketAndCondition({
    secret: sharedSecret,
    protocol: 'psk',
    destinationAmount,
    destinationAccount,
    data,
    uuid,
    expiresAt
  })
}

/**
  * Generate shared secret for Pre-Shared Key (PSK) transport protocol.
  *
  * @param {Object} params Parameters for creating PSK params
  * @param {String} params.destinationAccount The ILP address that will receive PSK payments
  * @param {String} params.secret secret used to generate the shared secret and the extra segments of destinationAccount
  * @param {String} params.id id id to distinguish from other receivers listening on the same PSK account. If supplied, it must be passed into the PSK.listen function's options.
  *
  * @return {PskParams}
  */
function generateParams ({
  destinationAccount,
  secret,
  // TODO: best way to do receiverId?
  id
}) {
  assert(typeof destinationAccount === 'string', 'destinationAccount must be a string')
  assert(Buffer.isBuffer(secret), 'secret must be a buffer')

  const receiverId = id || ''
  const token = cryptoHelper.getPskToken(secret)
  return {
    destinationAccount: destinationAccount + '.' + receiverId + token,
    sharedSecret: base64url(cryptoHelper.getPskSharedSecret(secret, token)
  }
}


function listen (plugin, {
  // TODO: best way to do receiverId?
  id,
  secret,
  allowOverPayment
}, callback) {
  assert(plugin && typeof plugin === 'object', 'plugin must be an object')
  assert(typeof callback === 'function', 'callback must be a function')
  assert(Buffer.isBuffer(shared), 'opts.secret must be a buffer')

  // TODO: do this async
  // yield plugin.connect()
  const receiverId = id || ''
  const sharedSecret = cryptoHelper.getPskSharedSecret(secret, receiverId)

  /**
   * When we receive a transfer notification, check the transfer
   * and try to fulfill the condition (which will only work if
   * it corresponds to a request or shared secret we created)
   * Calls the `reviewPayment` callback before fulfillingthe.
   *
   * Note return values are only for testing
   */
  function * autoFulfillCondition (transfer) {
    yield Transport.validateTransfer({
      plugin,
      transfer,
      receiverId,
      protocol: 'psk'
    })

    const preimage = cryptoHelper.hmacJsonForPskCondition(
      Packet.getFromTransfer(transfer),
      sharedSecret)

    if (transfer.executionCondition !== cc.toConditionUri(preimage)) {
      debug('notified of transfer where executionCondition does not' +
        ' match the one we generate.' +
        ' executionCondition=' + transfer.executionCondition +
        ' our condition=' + cc.toConditionUri(preimage))
      return
    }

    const decryptedData = cryptoHelper.aesDecryptObject(data, sharedSecret)
    const fulfillment = cc.toFulfillmentUri(conditionPreimage)

    callback({
      transfer: transfer,
      data: decryptedData,
      destinationAccount: address,
      destinationAmount: amount,
      fulfill: function () {
        return fulfillCondition(transfer.id, fulfillment)
      }
    })
  }
  
  plugin.on('incoming_prepare', co.wrap(autoFulfillCondition))
  return function () {
    plugin.removeListener('incoming_prepare', autoFulfillCondition)
  }
}
