'use strict'

const Packet = require('./packet')
const Transport = require('./transport')
const cryptoHelper = require('../utils/crypto')
const assert = require('assert')
const base64url = require('../utils/base64url')

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
function createPacketAndCondition (rawParams) {
  const params = Object.assign({}, rawParams, { secret: rawParams.sharedSecret })
  return Transport.createPacketAndCondition(params, 'psk')
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
  const token = base64url(cryptoHelper.getPskToken(secret))
  return {
    destinationAccount: destinationAccount + '.' + receiverId + token,
    sharedSecret: base64url(cryptoHelper.getPskSharedSecret(secret, token))
  }
}

function listen (plugin, params, callback) {
  return Transport.listen(plugin, params, callback, 'psk')
}

module.exports = {
  createPacketAndCondition,
  generateParams,
  listen
}
