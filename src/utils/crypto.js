'use strict'

const crypto = require('crypto')
const stringify = require('canonical-json')

const IPR_RECEIVER_ID_STRING = 'ilp_ipr_receiver_id'
const IPR_CONDITION_STRING = 'ilp_ipr_condition'
const PSK_GENERATION_STRING = 'ilp_psk_generation'
const PSK_CONDITION_STRING = 'ilp_psk_condition'
const PSK_ENCRYPTION_STRING = 'ilp_key_encryption'

function getPskToken () {
  return crypto.randomBytes(16)
}


function hmacJsonForIprCondition (hmacKey, obj) {
  const iprConditionKey = hmac(hmacKey, IPR_CONDITION_STRING)
  const jsonString = stringify(obj)
  return hmac(iprConditionKey, jsonString)
}

function getReceiverId (hmacKey) {
  return hmac(hmacKey, IPR_RECEIVER_ID_STRING).slice(0, 8)
}


function getPskSharedSecret (hmacKey, token) {
  const generator = hmac(hmacKey, PSK_GENERATION_STRING)
  return hmac(generator, token).slice(0, 16)
}

function hmac (key, message) {
  const h = crypto.createHmac('sha256', key)
  h.update(message, 'utf8')
  return h.digest()
}

function hmacJsonForPskCondition (obj, sharedSecret) {
  const pskConditionKey = hmac(sharedSecret, PSK_CONDITION_STRING)
  const jsonString = stringify(obj)
  const hmacDigest = hmac(pskConditionKey, jsonString)
  return hmacDigest
}

// turn object into encrypted buffer
function aesEncryptObject (obj, sharedSecret) {
  const pskEncryptionKey = hmac(sharedSecret, PSK_ENCRYPTION_STRING)
  const cipher = crypto.createCipher('aes-256-ctr', pskEncryptionKey)

  return Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(obj), 'utf8')),
    cipher.final()
  ])
}

// turn base64-encoded encrypted text into parsed object
function aesDecryptObject (encrypted, sharedSecret) {
  const pskEncryptionKey = hmac(sharedSecret, PSK_ENCRYPTION_STRING)
  const decipher = crypto.createDecipher('aes-256-ctr', pskEncryptionKey)

  const decoded = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final()
  ])

  try {
    return JSON.parse(decoded.toString('utf8'))
  } catch (e) {
    throw new Error('Corrupted ciphertext: ' + e.message)
  }
}

module.exports = {
  hmacJsonForPskCondition,
  aesEncryptObject,
  aesDecryptObject,
  getPskToken,
  hmacJsonForIprCondition,
  getReceiverId,
  getPskSharedSecret
}
