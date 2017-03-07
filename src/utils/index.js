'use strict'

const isUndefined = require('lodash/fp/isUndefined')
const omitUndefined = require('lodash/fp/omitBy')(isUndefined)

function xor (a, b) {
  return ((a || b) && (!a || !b))
}

module.exports = {
  xor,
  omitUndefined,
  isUndefined
}
