'use strict'

const isUndefined = require('lodash/fp/isUndefined')
const omitUndefined = require('lodash/fp/omitBy')(isUndefined)
const startsWith = require('lodash/fp/startsWith')

function xor (a, b) {
  return ((a || b) && (!a || !b))
}

function wait (duration) {
  return new Promise((resolve) => setTimeout(resolve, duration))
}

module.exports = {
  xor,
  wait,
  startsWith,
  omitUndefined,
  isUndefined
}
