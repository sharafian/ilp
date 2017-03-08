'use strict'

const Packet = require('./packet')
const moment = require('moment')
const cryptoHelper = require('../utils/crypto')
const uuid4 = require('uuid')
const cc = require('../utils/condition')
const co = require('co')
const debug = require('debug')('ilp:transport')
const assert = require('assert')
const base64url = require('../utils/base64url')
const BigNumber = require('bignumber.js')

function createPacketAndCondition ({
  destinationAmount,
  destinationAccount,
  secret,
  data,
  expiresAt,
  protocol
}) {
  assert(typeof destinationAmount === 'string', 'destinationAmount must be a string')
  assert(typeof destinationAccount === 'string', 'destinationAccount must be a string')
  assert(Buffer.isBuffer(secret), 'secret must be a buffer')

  const id = base64url(cryptoHelper.getReceiverId(secret))
  const address = destinationAccount + '.~' + protocol + '.' + id
  const blob = data && base64url(cryptoHelper.aesEncryptObject(data, secret))
  const packet = Packet.serialize({
    amount: destinationAmount,
    address: address,
    expiresAt: expiresAt,
    data: { blob }
  })

  const condition = base64url(cc.toCondition(
    cryptoHelper.hmacJsonForPskCondition(
      packet,
      secret)))

  return {
    packet,
    condition
  }
}

function _reject (plugin, id, reason) {
  return plugin
    .rejectIncomingTransfer(id, reason)
    .then(() => Promise.reject(new Error(reason)))
}

function listen (plugin, {
  // TODO: best way to do receiverId?
  secret,
  allowOverPayment
}, callback, protocol) {
  assert(plugin && typeof plugin === 'object', 'plugin must be an object')
  assert(typeof callback === 'function', 'callback must be a function')
  assert(Buffer.isBuffer(secret), 'opts.secret must be a buffer')

  // TODO: do this async
  // yield plugin.connect()

  /**
   * When we receive a transfer notification, check the transfer
   * and try to fulfill the condition (which will only work if
   * it corresponds to a request or shared secret we created)
   * Calls the `reviewPayment` callback before fulfillingthe.
   *
   * Note return values are only for testing
   */
  function * autoFulfillCondition (transfer) {
    // TODO: should this just be included in this function?
    yield _validateTransfer({
      plugin,
      transfer,
      protocol,
      allowOverPayment,
      secret
    })

    const preimage = cryptoHelper.hmacJsonForPskCondition(
      Packet.getFromTransfer(transfer),
      secret)

    if (transfer.executionCondition !== cc.toCondition(preimage)) {
      debug('notified of transfer where executionCondition does not' +
        ' match the one we generate.' +
        ' executionCondition=' + transfer.executionCondition +
        ' our condition=' + cc.toCondition(preimage))
      return false
    }

    const { address, amount, data, expiresAt } =
      Packet.parseFromTransfer(transfer)
    const decryptedData = cryptoHelper.aesDecryptObject(data.blob, secret)
    const fulfillment = cc.toFulfillment(preimage)

    callback({
      transfer: transfer,
      data: decryptedData,
      destinationAccount: address,
      destinationAmount: amount,
      fulfill: function () {
        return plugin.fulfillCondition(transfer.id, fulfillment)
      }
    })

    // for debugging purposes
    return true
  }
  
  const listener = co.wrap(autoFulfillCondition)
  plugin.on('incoming_prepare', listener)

  return function () {
    plugin.removeListener('incoming_prepare', listener)
  }
}

function * _validateTransfer ({
  plugin,
  transfer,
  protocol,
  allowOverPayment,
  secret
}) {
  const account = plugin.getAccount()
  const id = base64url(cryptoHelper.getReceiverId(secret))

  if (!transfer.executionCondition) {
    debug('notified of transfer without executionCondition ', transfer)
    return _reject(plugin, transfer.id, 'no-execution')
  }

  const { address, amount, data, expiresAt } =
    Packet.parseFromTransfer(transfer)
  const decryptedData = cryptoHelper.aesDecryptObject(data.blob, secret)

  if (address.indexOf(account) !== 0) {
    debug('notified of transfer for another account: account=' +
      address +
      ' me=' +
      account)
    throw new Error('not-my-packet')
  }

  const localPart = address.slice(account.length + 1)
  const [ addressProtocol, addressReceiverId ] = localPart.split('.')

  if (addressProtocol !== '~' + protocol) {
    debug('notified of transfer with protocol=' + addressProtocol)
    throw new Error('not-my-packet')
  }

  if (addressReceiverId !== id) {
    debug('notified of transfer for another receiver: receiver=' +
      addressReceiverId +
      ' me=' +
      id)
    throw new Error('not-my-packet')
  }

  const transferAmount = new BigNumber(transfer.amount)

  if (transferAmount.lessThan(amount)) {
    debug('notified of transfer amount smaller than packet amount:' +
      ' transfer=' + transfer.amount +
      ' packet=' + amount)
    throw new Error('insufficient')
  }

  if (!allowOverPayment && transferAmount.greaterThan(amount)) {
    debug('notified of transfer amount larger than packet amount:' +
      ' transfer=' + transfer.amount +
      ' packet=' + amount)
    throw new Error('overpayment')
  }

  if (expiresAt && moment().isAfter(expiresAt)) {
    debug('notified of transfer with expired packet:', transfer)
    return _reject(plugin, transfer.id, 'expired')
  }
}

module.exports = {
  _reject,
  _validateTransfer: co.wrap(_validateTransfer),
  createPacketAndCondition,
  listen
}
