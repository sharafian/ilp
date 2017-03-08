'use strict'

const Transport = require('./transport')
const cryptoHelper = require('../utils/crypto')

/**
  * Create a payment request for use in the IPR transport protocol.
  *
  * @param {Object} params Parameters for creating payment request
  * @param {String} params.destinationAmount Amount that should arrive in the recipient's account
  * @param {String} params.destinationAccount Target account's ILP address
  * @param {String} params.secret Secret for generating IPR packets
  * @param {String} [params.id=uuid.v4()] Unique ID for the request (used to ensure conditions are unique per request)
  * @param {String} [params.expiresAt=30 seconds from now] Expiry of request
  * @param {Object} [params.data=null] Additional data to include in the request
  *
  * @return {Object} Payment request
  */
function createPacketAndCondition (rawParams) {
  return Transport.createPacketAndCondition(params, 'ipr')
}

function listen (plugin, rawParams, callback) {
  return Transport.listen(plugin, params, callback, 'ipr')
}

module.exports = {
  createPacketAndCondition,
  listen
}
