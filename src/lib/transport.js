'use strict'

const Packet = require('./packet')
const moment = require('moment')
const cryptoHelper = require('../utils/crypto')
const cc = require('../utils/condition')
const co = require('co')
const debug = require('debug')('ilp:transport')
const assert = require('assert')
const base64url = require('../utils/base64url')
const BigNumber = require('bignumber.js')
const { safeConnect } = require('../utils')

function createPacketAndCondition ({
  id,
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

  const receiverId = base64url(cryptoHelper.getReceiverId(secret))
  const address = destinationAccount + '.~' + protocol + '.' + receiverId
    + (id ? ('.' + id) : '')

  const blobData = { expiresAt, data }
  const blob = data &&
    base64url(cryptoHelper.aesEncryptObject(blobData, secret))

  const packet = Packet.serialize({
    destinationAccount: address,
    destinationAmount,
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
    .then(() => reason)
}

function * listen (plugin, {
  secret,
  allowOverPayment
}, callback, protocol) {
  assert(plugin && typeof plugin === 'object', 'plugin must be an object')
  assert(typeof callback === 'function', 'callback must be a function')
  assert(Buffer.isBuffer(secret), 'opts.secret must be a buffer')

  yield safeConnect(plugin)

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
    const err = yield _validateOrRejectTransfer({
      plugin,
      transfer,
      protocol,
      allowOverPayment,
      secret
    })

    if (err) return err

    const preimage = cryptoHelper.hmacJsonForPskCondition(
      Packet.getFromTransfer(transfer),
      secret)

    if (transfer.executionCondition !== cc.toCondition(preimage)) {
      debug('notified of transfer where executionCondition does not' +
        ' match the one we generate.' +
        ' executionCondition=' + transfer.executionCondition +
        ' our condition=' + cc.toCondition(preimage))
      return yield _reject(plugin, transfer.id, 'condition-mismatch')
    }

    const { destinationAccount, destinationAmount, data } =
      Packet.parseFromTransfer(transfer)
    const decryptedData = cryptoHelper.aesDecryptObject(data.blob, secret)
    const fulfillment = cc.toFulfillment(preimage)

    callback({
      transfer: transfer,
      data: decryptedData,
      destinationAccount,
      destinationAmount,
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

function * _validateOrRejectTransfer ({
  plugin,
  transfer,
  protocol,
  allowOverPayment,
  secret
}) {
  const account = plugin.getAccount()
  const receiverId = base64url(cryptoHelper.getReceiverId(secret))

  if (!transfer.executionCondition) {
    debug('notified of transfer without executionCondition ', transfer)
    return yield _reject(plugin, transfer.id, 'no-execution')
  }

  const { destinationAccount, destinationAmount, data } =
    Packet.parseFromTransfer(transfer)

  const decryptedData = data.blob
    ? cryptoHelper.aesDecryptObject(data.blob, secret)
    : {}

  const expiresAt = decryptedData.expiresAt

  if (destinationAccount.indexOf(account) !== 0) {
    debug('notified of transfer for another account: account=' +
      destinationAccount +
      ' me=' +
      account)
    return 'not-my-packet'
  }

  const localPart = destinationAccount.slice(account.length + 1)
  const [ addressProtocol, addressReceiverId ] = localPart.split('.')

  if (addressProtocol !== '~' + protocol) {
    debug('notified of transfer with protocol=' + addressProtocol)
    return 'not-my-packet'
  }

  if (addressReceiverId !== receiverId) {
    debug('notified of transfer for another receiver: receiver=' +
      addressReceiverId +
      ' me=' +
      receiverId)
    return 'not-my-packet'
  }

  const amount = new BigNumber(transfer.amount)

  if (amount.lessThan(destinationAmount)) {
    debug('notified of transfer amount smaller than packet amount:' +
      ' transfer=' + transfer.amount +
      ' packet=' + destinationAmount)
    return yield _reject(plugin, transfer.id, 'insufficient')
  }

  if (!allowOverPayment && amount.greaterThan(destinationAmount)) {
    debug('notified of transfer amount larger than packet amount:' +
      ' transfer=' + transfer.amount +
      ' packet=' + destinationAmount)
    return yield _reject(plugin, transfer.id, 'overpayment')
  }

  if (expiresAt && moment().isAfter(expiresAt)) {
    debug('notified of transfer with expired packet:', transfer)
    return yield _reject(plugin, transfer.id, 'expired')
  }
}

module.exports = {
  _reject,
  _validateOrRejectTransfer: co.wrap(_validateOrRejectTransfer),
  createPacketAndCondition,
  listen: co.wrap(listen)
}
