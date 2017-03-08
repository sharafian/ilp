'use strict'

const crypto = require('crypto')
const base64url = require('./base64url')

function toCondition (conditionPreimage) {
  const hash = crypto.createHash('sha256')
  hash.update(conditionPreimage)
  const condition = hash.digest()
  return base64url(condition)
}

function toFulfillment (conditionPreimage) {
  return base64url(conditionPreimage)
}

Object.assign(exports, {
  toCondition,
  toFulfillment
})
