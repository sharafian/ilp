'use strict'

const Packet = require('./packet')
const cryptoHelper = require('../utils/crypto')

function createPacketAndCondition ({
  destinationAmount,
  destinationAccount,
  secret,
  data,
  uuid,
  expiresAt,
  protocol
}) {
  assert(typeof destinationAmount === 'string', 'destinationAmount must be a string')
  assert(typeof destinationAccount === 'string', 'destinationAccount must be a string')
  assert(Buffer.isBuffer(secret), 'secret must be a buffer')

  const address = params.destinationAccount + '.~' + protocol + '.' + (params.id || uuid4())
  const blob = data && base64url(cryptoHelper.aesEncryptData(data), secret)
  const packet = Packet.serialize({
    amount: params.destinationAmount,
    address: address,
    expiresAt: expiresAt
    data: blob
  })

  // TODO: should this use the 'ni:' format or just be base64url?
  const condition = cryptoHelper.hmacJsonForPskCondition(
    packet,
    sharedSecret)

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

function validateTransfer ({
  plugin,
  transfer,
  receiverId,
  protocol
}) {
  const account = plugin.getAccount()

  if (!transfer.executionCondition) {
    debug('notified of transfer without executionCondition ', transfer)
    return _reject(plugin, transfer.id, 'no-execution')
  }

  const { address, amount, data, expiresAt } =
    Packet.parseFromTransfer(transfer)

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
    debug('notified of transfer with protocol=' + protocol)
    throw new Error('not-my-packet')
  }

  if (addressReceiverId !== receiverId) {
    debug('notified of transfer for another receiver: receiver=' +
      addressReceiverId +
      ' me=' +
      receiverId)
    throw new Error('not-my-packet')
  }

  const transferAmount = new BigNumber(transfer.amount)

  if (transferAmount.lessThan(amount)) {
    debug('notified of transfer amount smaller than packet amount:' +
      ' transfer=' + transfer.amount
      ' packet=' + amount)
    throw new Error('insufficient')
  }

  if (!allowOverPayment && transferAmount.greaterThan(amount)) {
    debug('notified of transfer amount larger than packet amount:' +
      ' transfer=' + transfer.amount
      ' packet=' + amount)
    throw new Error('overpayment')
  }

  if (expiresAt && moment().isAfter(expiresAt)) {
    debug('notified of transfer with expired packet:', transfer)
    return _reject(transfer.id, 'expired')
  }
}
