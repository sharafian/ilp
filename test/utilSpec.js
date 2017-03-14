'use strict'

const chai = require('chai')
const assert = chai.assert
const Crypto = require('../src/utils/crypto')
const Details = require('../src/utils/details')
const Utils = require('../src/utils')

describe('Utils', function () {
  describe('cryptoHelper', function () {
    it('should not decrypt corrupted ciphertext', function () {
      assert
        .throws(() => Crypto.aesDecryptObject('garbage', Buffer.from('trash', 'base64')))
    })
  })

  describe('details', function ()  {
    it('should not parse an invalid request', function () {
      assert.throws(() => Details._parseRequest(Buffer.from('garbage', 'utf8')),
        /invalid request:/)
    })

    it('should not parse a request with an invalid status line', function () {
      const request = `PSK/1.0 GARBAGE
Header: stuff

binary data goes here
      `
      assert.throws(() => Details._parseRequest(Buffer.from(request, 'utf8')),
        /invalid status line:/)
    })

    it('should not parse a request with an invalid header line', function () {
      const request = `PSK/1.0 PRIVATE
Header without a colon

binary data goes here
      `
      assert.throws(() => Details._parseRequest(Buffer.from(request, 'utf8')),
        /invalid header line:/)
    })
  })
})
